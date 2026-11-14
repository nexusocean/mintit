import { Logger } from '@nestjs/common';

// Services log every tick and failure; keep test output readable.
Logger.overrideLogger(false);
