import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common'
import type { Request, Response } from 'express'

/**
 * Uniform JSON error envelope for every unhandled/HTTP exception:
 *   { statusCode, error, path }
 * Never leaks internals: non-HttpException errors become a generic 500 and the
 * real error is logged server-side only.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exception')

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const res = ctx.getResponse<Response>()
    const req = ctx.getRequest<Request>()

    const isHttp = exception instanceof HttpException
    const status = isHttp ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR

    let message: string
    if (isHttp) {
      const body = exception.getResponse()
      message = typeof body === 'string' ? body : ((body as { message?: string }).message ?? exception.message)
    } else {
      message = 'Internal server error'
      this.logger.error(`${req.method} ${req.url}`, exception instanceof Error ? exception.stack : String(exception))
    }

    res.status(status).json({ statusCode: status, error: message, path: req.url })
  }
}
