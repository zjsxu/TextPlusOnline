const express = require('express');
const router = express.Router();
const Joi = require('joi');
const path = require('path');
const fs = require('fs').promises;

const DatabaseService = require('../services/DatabaseService');
const AuthMiddleware = require('../middleware/auth');
const { redis: rateLimiter } = require('../middleware/rateLimiter');
const logger = require('../utils/logger');

// 数据验证模式
const reportRequestSchema = Joi.object({
  reportName: Joi.string().min(1).max(100).required(),
  reportType: Joi.string().valid('pdf', 'csv', 'json').required(),
  parameters: Joi.object({
    startDate: Joi.date().iso().required(),
    endDate: Joi.date().iso().required(),
    metrics: Joi.array().items(Joi.string()).default(['page_views', 'sessions', 'users']),
    granularity: Joi.string().valid('hour', 'day', 'week', 'month').default('day'),
    includeCharts: Joi.boolean().default(true),
    includeRawData: Joi.boolean().default(false)
  }).required(),
  shareEnabled: Joi.boolean().default(false),
  expiresInDays: Joi.number().integer().min(1).max(30).default(7)
});

// 报告生成服务
class ReportGenerationService {
  static async generateCSVReport(parameters) {
    // 获取数据
    const sessionStats = await DatabaseService.getSessionStats(
      parameters.startDate,
      parameters.endDate,
      parameters.granularity
    );

    // 生成CSV内容
    let csvContent = 'Date,Sessions,Unique Visitors,Avg Duration,Bounce Rate\n';
    
    for (const row of sessionStats) {
      csvContent += `${row.time_bucket},${row.sessions},${row.unique_visitors},${row.avg_duration || 0},${row.bounce_rate || 0}\n`;
    }

    return csvContent;
  }

  static async generateJSONReport(parameters) {
    const data = {};

    // 获取会话统计
    if (parameters.metrics.includes('sessions') || parameters.metrics.includes('users')) {
      data.sessions = await DatabaseService.getSessionStats(
        parameters.startDate,
        parameters.endDate,
        parameters.granularity
      );
    }

    // 获取热门页面
    if (parameters.metrics.includes('pages')) {
      data.topPages = await DatabaseService.getTopPages(
        parameters.startDate,
        parameters.endDate,
        10
      );
    }

    // 获取地理分布
    if (parameters.metrics.includes('geography')) {
      data.geography = await DatabaseService.getGeographicDistribution(
        parameters.startDate,
        parameters.endDate
      );
    }

    return JSON.stringify({
      reportMetadata: {
        generatedAt: new Date().toISOString(),
        period: {
          start: parameters.startDate,
          end: parameters.endDate
        },
        granularity: parameters.granularity,
        metrics: parameters.metrics
      },
      data
    }, null, 2);
  }

  static async generatePDFReport(parameters) {
    // 这里应该使用PDF生成库如puppeteer或jsPDF
    // 现在返回一个简单的文本报告
    const jsonData = await this.generateJSONReport(parameters);
    const data = JSON.parse(jsonData);

    let pdfContent = `
Analytics Report
Generated: ${new Date().toISOString()}
Period: ${parameters.startDate} to ${parameters.endDate}

Summary:
`;

    if (data.data.sessions) {
      const totalSessions = data.data.sessions.reduce((sum, row) => sum + parseInt(row.sessions), 0);
      const totalUsers = data.data.sessions.reduce((sum, row) => sum + parseInt(row.unique_visitors), 0);
      
      pdfContent += `
Total Sessions: ${totalSessions}
Unique Visitors: ${totalUsers}
`;
    }

    if (data.data.topPages) {
      pdfContent += `\nTop Pages:\n`;
      data.data.topPages.forEach((page, index) => {
        pdfContent += `${index + 1}. ${page.landing_page} (${page.visits} visits)\n`;
      });
    }

    return pdfContent;
  }

  static async saveReportFile(content, fileName, reportType) {
    const reportsDir = path.join(process.cwd(), 'reports');
    
    // 确保报告目录存在
    try {
      await fs.access(reportsDir);
    } catch {
      await fs.mkdir(reportsDir, { recursive: true });
    }

    const filePath = path.join(reportsDir, fileName);
    await fs.writeFile(filePath, content, 'utf8');
    
    const stats = await fs.stat(filePath);
    return {
      filePath: filePath,
      fileSize: stats.size,
      relativePath: `reports/${fileName}`
    };
  }

  static generateShareToken() {
    return `share_${Date.now()}_${Math.random().toString(36).substr(2, 16)}`;
  }
}

// POST /api/reports/generate - 生成报告
router.post('/generate',
  AuthMiddleware.verifyToken,
  rateLimiter.reportGeneration(),
  async (req, res) => {
    try {
      // 验证请求数据
      const { error, value } = reportRequestSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          error: {
            message: 'Validation failed',
            details: error.details,
            status: 400
          }
        });
      }

      const reportData = value;
      const shareToken = reportData.shareEnabled ? 
        ReportGenerationService.generateShareToken() : null;
      
      const expiresAt = new Date(Date.now() + reportData.expiresInDays * 24 * 60 * 60 * 1000);

      // 创建报告生成记录
      const reportRecord = await DatabaseService.createReportGeneration({
        reportName: reportData.reportName,
        reportType: reportData.reportType,
        parameters: reportData.parameters,
        generatedBy: req.user.id,
        shareToken,
        expiresAt
      });

      // 异步生成报告
      setImmediate(async () => {
        try {
          let content;
          let fileName = `${reportData.reportName}_${Date.now()}.${reportData.reportType}`;

          // 根据报告类型生成内容
          switch (reportData.reportType) {
            case 'csv':
              content = await ReportGenerationService.generateCSVReport(reportData.parameters);
              break;
            case 'json':
              content = await ReportGenerationService.generateJSONReport(reportData.parameters);
              break;
            case 'pdf':
              content = await ReportGenerationService.generatePDFReport(reportData.parameters);
              break;
            default:
              throw new Error(`Unsupported report type: ${reportData.reportType}`);
          }

          // 保存文件
          const fileInfo = await ReportGenerationService.saveReportFile(
            content,
            fileName,
            reportData.reportType
          );

          // 更新报告记录
          await DatabaseService.updateReportGeneration(reportRecord.id, {
            status: 'completed',
            filePath: fileInfo.relativePath,
            fileSize: fileInfo.fileSize
          });

          logger.analytics('report_generated', {
            reportId: reportRecord.id,
            reportType: reportData.reportType,
            userId: req.user.id,
            fileSize: fileInfo.fileSize
          });

        } catch (error) {
          logger.error('Report generation error:', error);
          
          await DatabaseService.updateReportGeneration(reportRecord.id, {
            status: 'failed',
            filePath: null,
            fileSize: 0
          });
        }
      });

      res.status(202).json({
        success: true,
        message: 'Report generation started',
        reportId: reportRecord.id,
        shareToken: shareToken,
        estimatedCompletionTime: new Date(Date.now() + 2 * 60 * 1000).toISOString(), // 2分钟后
        status: 'generating'
      });

    } catch (error) {
      logger.error('Report generation request error:', error);
      res.status(500).json({
        error: {
          message: 'Failed to start report generation',
          status: 500
        }
      });
    }
  }
);

// GET /api/reports/:reportId/status - 获取报告生成状态
router.get('/:reportId/status',
  AuthMiddleware.verifyToken,
  async (req, res) => {
    try {
      const { reportId } = req.params;

      const report = await DatabaseService.query(
        'SELECT * FROM report_generations WHERE id = $1 AND generated_by = $2',
        [reportId, req.user.id]
      );

      if (!report.rows[0]) {
        return res.status(404).json({
          error: {
            message: 'Report not found',
            status: 404
          }
        });
      }

      const reportData = report.rows[0];

      res.json({
        reportId: reportData.id,
        status: reportData.status,
        reportName: reportData.report_name,
        reportType: reportData.report_type,
        fileSize: reportData.file_size,
        createdAt: reportData.created_at,
        updatedAt: reportData.updated_at,
        expiresAt: reportData.expires_at,
        shareToken: reportData.share_token,
        downloadUrl: reportData.status === 'completed' ? 
          `/api/reports/${reportId}/download` : null
      });

    } catch (error) {
      logger.error('Get report status error:', error);
      res.status(500).json({
        error: {
          message: 'Failed to get report status',
          status: 500
        }
      });
    }
  }
);

// GET /api/reports/:reportId/download - 下载报告
router.get('/:reportId/download',
  AuthMiddleware.verifyToken,
  async (req, res) => {
    try {
      const { reportId } = req.params;

      const report = await DatabaseService.query(
        'SELECT * FROM report_generations WHERE id = $1 AND generated_by = $2',
        [reportId, req.user.id]
      );

      if (!report.rows[0]) {
        return res.status(404).json({
          error: {
            message: 'Report not found',
            status: 404
          }
        });
      }

      const reportData = report.rows[0];

      if (reportData.status !== 'completed') {
        return res.status(400).json({
          error: {
            message: 'Report is not ready for download',
            status: 400,
            currentStatus: reportData.status
          }
        });
      }

      if (new Date() > new Date(reportData.expires_at)) {
        return res.status(410).json({
          error: {
            message: 'Report has expired',
            status: 410
          }
        });
      }

      const filePath = path.join(process.cwd(), reportData.file_path);
      
      try {
        await fs.access(filePath);
      } catch {
        return res.status(404).json({
          error: {
            message: 'Report file not found',
            status: 404
          }
        });
      }

      // 设置下载头
      const fileName = `${reportData.report_name}.${reportData.report_type}`;
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.setHeader('Content-Type', this.getContentType(reportData.report_type));

      // 发送文件
      const fileContent = await fs.readFile(filePath);
      res.send(fileContent);

      logger.analytics('report_downloaded', {
        reportId: reportData.id,
        userId: req.user.id,
        reportType: reportData.report_type
      });

    } catch (error) {
      logger.error('Report download error:', error);
      res.status(500).json({
        error: {
          message: 'Failed to download report',
          status: 500
        }
      });
    }
  }
);

// GET /api/reports/shared/:shareToken - 通过分享令牌访问报告
router.get('/shared/:shareToken', async (req, res) => {
  try {
    const { shareToken } = req.params;

    const report = await DatabaseService.getReportByShareToken(shareToken);

    if (!report) {
      return res.status(404).json({
        error: {
          message: 'Shared report not found or expired',
          status: 404
        }
      });
    }

    if (report.status !== 'completed') {
      return res.status(400).json({
        error: {
          message: 'Report is not ready',
          status: 400
        }
      });
    }

    const filePath = path.join(process.cwd(), report.file_path);
    
    try {
      await fs.access(filePath);
    } catch {
      return res.status(404).json({
        error: {
          message: 'Report file not found',
          status: 404
        }
      });
    }

    // 设置下载头
    const fileName = `${report.report_name}.${report.report_type}`;
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Type', this.getContentType(report.report_type));

    // 发送文件
    const fileContent = await fs.readFile(filePath);
    res.send(fileContent);

    logger.analytics('shared_report_accessed', {
      reportId: report.id,
      shareToken: shareToken.substring(0, 8) + '...',
      reportType: report.report_type
    });

  } catch (error) {
    logger.error('Shared report access error:', error);
    res.status(500).json({
      error: {
        message: 'Failed to access shared report',
        status: 500
      }
    });
  }
});

// GET /api/reports - 获取用户的报告列表
router.get('/',
  AuthMiddleware.verifyToken,
  async (req, res) => {
    try {
      const { page = 1, limit = 20, status = 'all' } = req.query;
      const offset = (page - 1) * limit;

      let whereClause = 'WHERE generated_by = $1';
      const params = [req.user.id];

      if (status !== 'all') {
        whereClause += ' AND status = $2';
        params.push(status);
      }

      const reports = await DatabaseService.query(`
        SELECT id, report_name, report_type, status, file_size, 
               share_token, expires_at, created_at, updated_at
        FROM report_generations
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `, [...params, limit, offset]);

      const totalResult = await DatabaseService.query(`
        SELECT COUNT(*) FROM report_generations ${whereClause}
      `, params);

      const total = parseInt(totalResult.rows[0].count);

      res.json({
        reports: reports.rows.map(report => ({
          ...report,
          downloadUrl: report.status === 'completed' ? 
            `/api/reports/${report.id}/download` : null,
          shareUrl: report.share_token ? 
            `/api/reports/shared/${report.share_token}` : null
        })),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      });

    } catch (error) {
      logger.error('Get reports error:', error);
      res.status(500).json({
        error: {
          message: 'Failed to get reports',
          status: 500
        }
      });
    }
  }
);

// DELETE /api/reports/:reportId - 删除报告
router.delete('/:reportId',
  AuthMiddleware.verifyToken,
  async (req, res) => {
    try {
      const { reportId } = req.params;

      const report = await DatabaseService.query(
        'SELECT * FROM report_generations WHERE id = $1 AND generated_by = $2',
        [reportId, req.user.id]
      );

      if (!report.rows[0]) {
        return res.status(404).json({
          error: {
            message: 'Report not found',
            status: 404
          }
        });
      }

      const reportData = report.rows[0];

      // 删除文件
      if (reportData.file_path) {
        const filePath = path.join(process.cwd(), reportData.file_path);
        try {
          await fs.unlink(filePath);
        } catch (error) {
          logger.warn('Failed to delete report file:', error);
        }
      }

      // 删除数据库记录
      await DatabaseService.query(
        'DELETE FROM report_generations WHERE id = $1',
        [reportId]
      );

      logger.analytics('report_deleted', {
        reportId: reportData.id,
        userId: req.user.id,
        reportType: reportData.report_type
      });

      res.json({
        success: true,
        message: 'Report deleted successfully'
      });

    } catch (error) {
      logger.error('Delete report error:', error);
      res.status(500).json({
        error: {
          message: 'Failed to delete report',
          status: 500
        }
      });
    }
  }
);

// 辅助方法：获取内容类型
function getContentType(reportType) {
  const contentTypes = {
    'pdf': 'application/pdf',
    'csv': 'text/csv',
    'json': 'application/json'
  };
  return contentTypes[reportType] || 'application/octet-stream';
}

module.exports = router;