import { Inject } from '@nestjs/common';
import { getQueueToken } from './queue-token';

export const InjectQueue = (name: string) => Inject(getQueueToken(name));
