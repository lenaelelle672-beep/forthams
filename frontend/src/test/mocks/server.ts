import { setupServer } from 'msw/node';
import { handlers } from './handlers';

/** MSW server instance pre-configured with shared handlers */
export const server = setupServer(...handlers);
