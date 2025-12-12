const logger = require('../utils/logger');

class ErrorHandler {
  static handle(err, req, res, next) {
    // 记录错误
    logger.error('API Error:', {
      error: err.message,
      stack: err.stack,
      url: req.originalUrl,
      method: req.method,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    // 默认错误响应
    let statusCode = 500;
    let message = 'Internal Server Error';
    let details = null;

    // 根据错误类型设置响应
    if (err.name === 'ValidationError') {
      statusCode = 400;
      message = 'Validation Error';
      details = err.details || err.message;
    } else if (err.name === 'UnauthorizedError' || err.message.includes('jwt')) {
      statusCode = 401;
      message = 'Unauthorized';
    } else if (err.name === 'ForbiddenError') {
      statusCode = 403;
      message = 'Forbidden';
    } else if (err.name === 'NotFoundError') {
      statusCode = 404;
      message = 'Not Found';
    } else if (err.name === 'ConflictError') {
      statusCode = 409;
      message = 'Conflict';
    } else if (err.name === 'TooManyRequestsError') {
      statusCode = 429;
      message = 'Too Many Requests';
    } else if (err.statusCode) {
      statusCode = err.statusCode;
      message = err.message;
    }

    // 构建错误响应
    const errorResponse = {
      error: {
        message,
        status: statusCode,
        timestamp: new Date().toISOString(),
        path: req.originalUrl,
        method: req.method
      }
    };

    // 在开发环境中包含更多错误信息
    if (process.env.NODE_ENV === 'development') {
      errorResponse.error.stack = err.stack;
      if (details) {
        errorResponse.error.details = details;
      }
    }

    // 发送错误响应
    res.status(statusCode).json(errorResponse);
  }

  static notFound(req, res, next) {
    const error = new Error(`Not Found - ${req.originalUrl}`);
    error.name = 'NotFoundError';
    next(error);
  }

  static asyncHandler(fn) {
    return (req, res, next) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  }
}

module.exports = ErrorHandler.handle;