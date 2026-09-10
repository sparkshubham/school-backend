import { Prisma } from '@prisma/client';

export class AppError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

export function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

export function errorHandler(err, req, res, next) {
  let status = err.status || 500;
  let message = err.message || 'Server error';

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      status = 409;
      message = 'A record with those unique details already exists';
    } else if (err.code === 'P2025') {
      status = 404;
      message = 'Not found';
    } else if (err.code === 'P2003') {
      status = 400;
      message = 'Related record was not found';
    }
  }

  if (status >= 500) console.error(err);
  res.status(status).json({
    message,
    ...(process.env.NODE_ENV !== 'production' && status >= 500 ? { stack: err.stack } : {}),
  });
}

export function notFound(req, res) {
  res.status(404).json({ message: `Not found: ${req.originalUrl}` });
}
