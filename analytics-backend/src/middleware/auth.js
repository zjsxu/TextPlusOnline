const jwt = require('jsonwebtoken');
const config = require('../config/config');
const DatabaseService = require('../services/DatabaseService');
const logger = require('../utils/logger');

class AuthMiddleware {
  // JWT令牌验证中间件
  static async verifyToken(req, res, next) {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          error: {
            message: 'Access token required',
            status: 401
          }
        });
      }

      const token = authHeader.substring(7); // 移除 'Bearer ' 前缀
      
      // 验证JWT令牌
      const decoded = jwt.verify(token, config.jwt.secret);
      
      // 获取用户信息
      const user = await DatabaseService.query(
        'SELECT id, username, email, role, is_active FROM admin_users WHERE id = $1',
        [decoded.userId]
      );

      if (!user.rows[0]) {
        return res.status(401).json({
          error: {
            message: 'Invalid token - user not found',
            status: 401
          }
        });
      }

      const userData = user.rows[0];

      if (!userData.is_active) {
        return res.status(401).json({
          error: {
            message: 'Account is disabled',
            status: 401
          }
        });
      }

      // 将用户信息添加到请求对象
      req.user = {
        id: userData.id,
        username: userData.username,
        email: userData.email,
        role: userData.role
      };

      next();
    } catch (error) {
      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({
          error: {
            message: 'Invalid token',
            status: 401
          }
        });
      } else if (error.name === 'TokenExpiredError') {
        return res.status(401).json({
          error: {
            message: 'Token expired',
            status: 401
          }
        });
      } else {
        logger.error('Auth middleware error:', error);
        return res.status(500).json({
          error: {
            message: 'Authentication error',
            status: 500
          }
        });
      }
    }
  }

  // 可选的JWT验证（不强制要求登录）
  static async optionalAuth(req, res, next) {
    try {
      const authHeader = req.headers.authorization;
      
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        const decoded = jwt.verify(token, config.jwt.secret);
        
        const user = await DatabaseService.query(
          'SELECT id, username, email, role, is_active FROM admin_users WHERE id = $1',
          [decoded.userId]
        );

        if (user.rows[0] && user.rows[0].is_active) {
          req.user = {
            id: user.rows[0].id,
            username: user.rows[0].username,
            email: user.rows[0].email,
            role: user.rows[0].role
          };
        }
      }

      next();
    } catch (error) {
      // 可选认证失败时不阻止请求
      next();
    }
  }

  // 角色权限检查
  static requireRole(roles) {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({
          error: {
            message: 'Authentication required',
            status: 401
          }
        });
      }

      const userRole = req.user.role;
      const allowedRoles = Array.isArray(roles) ? roles : [roles];

      if (!allowedRoles.includes(userRole)) {
        logger.security('Insufficient permissions', {
          userId: req.user.id,
          userRole,
          requiredRoles: allowedRoles,
          endpoint: req.originalUrl
        });

        return res.status(403).json({
          error: {
            message: 'Insufficient permissions',
            status: 403
          }
        });
      }

      next();
    };
  }

  // 管理员权限检查
  static requireAdmin(req, res, next) {
    return AuthMiddleware.requireRole(['admin', 'super_admin'])(req, res, next);
  }

  // 超级管理员权限检查
  static requireSuperAdmin(req, res, next) {
    return AuthMiddleware.requireRole('super_admin')(req, res, next);
  }

  // API密钥验证（用于外部系统集成）
  static async verifyApiKey(req, res, next) {
    try {
      const apiKey = req.headers['x-api-key'];
      
      if (!apiKey) {
        return res.status(401).json({
          error: {
            message: 'API key required',
            status: 401
          }
        });
      }

      // 从数据库或配置中验证API密钥
      const validApiKeys = await DatabaseService.getSystemConfig('api_keys');
      
      if (!validApiKeys || !validApiKeys.includes(apiKey)) {
        logger.security('Invalid API key', {
          apiKey: apiKey.substring(0, 8) + '...',
          ip: req.ip,
          userAgent: req.get('User-Agent')
        });

        return res.status(401).json({
          error: {
            message: 'Invalid API key',
            status: 401
          }
        });
      }

      // 标记为API请求
      req.isApiRequest = true;
      next();
    } catch (error) {
      logger.error('API key verification error:', error);
      return res.status(500).json({
        error: {
          message: 'API key verification failed',
          status: 500
        }
      });
    }
  }

  // 生成JWT令牌
  static generateToken(userId, expiresIn = null) {
    const payload = {
      userId,
      iat: Math.floor(Date.now() / 1000)
    };

    const options = {
      expiresIn: expiresIn || config.jwt.expiresIn
    };

    return jwt.sign(payload, config.jwt.secret, options);
  }

  // 验证令牌（不通过中间件）
  static verifyTokenSync(token) {
    try {
      return jwt.verify(token, config.jwt.secret);
    } catch (error) {
      return null;
    }
  }

  // 刷新令牌
  static async refreshToken(req, res, next) {
    try {
      const { refreshToken } = req.body;
      
      if (!refreshToken) {
        return res.status(400).json({
          error: {
            message: 'Refresh token required',
            status: 400
          }
        });
      }

      // 验证刷新令牌
      const decoded = jwt.verify(refreshToken, config.jwt.secret);
      
      // 检查用户是否仍然有效
      const user = await DatabaseService.query(
        'SELECT id, username, email, role, is_active FROM admin_users WHERE id = $1',
        [decoded.userId]
      );

      if (!user.rows[0] || !user.rows[0].is_active) {
        return res.status(401).json({
          error: {
            message: 'Invalid refresh token',
            status: 401
          }
        });
      }

      // 生成新的访问令牌
      const newToken = AuthMiddleware.generateToken(decoded.userId);
      
      res.json({
        token: newToken,
        user: {
          id: user.rows[0].id,
          username: user.rows[0].username,
          email: user.rows[0].email,
          role: user.rows[0].role
        }
      });
    } catch (error) {
      if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
        return res.status(401).json({
          error: {
            message: 'Invalid refresh token',
            status: 401
          }
        });
      }
      
      logger.error('Token refresh error:', error);
      return res.status(500).json({
        error: {
          message: 'Token refresh failed',
          status: 500
        }
      });
    }
  }

  // 登出（将令牌加入黑名单）
  static async logout(req, res, next) {
    try {
      const authHeader = req.headers.authorization;
      
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        
        // 将令牌添加到Redis黑名单
        const decoded = jwt.decode(token);
        if (decoded && decoded.exp) {
          const ttl = decoded.exp - Math.floor(Date.now() / 1000);
          if (ttl > 0) {
            await RedisService.set(`blacklist:${token}`, true, ttl);
          }
        }
      }

      res.json({ message: 'Logged out successfully' });
    } catch (error) {
      logger.error('Logout error:', error);
      res.status(500).json({
        error: {
          message: 'Logout failed',
          status: 500
        }
      });
    }
  }

  // 检查令牌是否在黑名单中
  static async checkBlacklist(req, res, next) {
    try {
      const authHeader = req.headers.authorization;
      
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        const isBlacklisted = await RedisService.exists(`blacklist:${token}`);
        
        if (isBlacklisted) {
          return res.status(401).json({
            error: {
              message: 'Token has been revoked',
              status: 401
            }
          });
        }
      }

      next();
    } catch (error) {
      logger.error('Blacklist check error:', error);
      next(); // 如果检查失败，允许请求继续
    }
  }
}

module.exports = AuthMiddleware;