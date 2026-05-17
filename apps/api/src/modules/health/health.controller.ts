import { Controller, Get } from '@nestjs/common';

@Controller()
export class HealthController {
  @Get('/health')
  getHealth() {
    return { ok: true, service: 'api' };
  }

  @Get('/v1/meta')
  getMeta() {
    return {
      name: 'Architecture Flow API',
      status: 'bootstrap',
      modules: ['work-items', 'artifacts', 'workflow', 'audit'],
    };
  }
}
