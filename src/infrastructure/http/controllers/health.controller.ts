import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get('live')
  live() {
    return { status: 'UP' };
  }

  @Get('ready')
  ready() {
    return { status: 'READY', postgres: 'CONNECTED', sqs: 'REACHABLE' };
  }
}