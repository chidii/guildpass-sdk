// GuildPass SDK: Pull in package or module bindings.
import { GuildPassErrorCode } from './errorCodes';

// GuildPass SDK: Exposed interface structure.
export class GuildPassError extends Error {
  // GuildPass SDK: Class member structure property or constructor.
  public readonly code: GuildPassErrorCode;
  // GuildPass SDK: Class member structure property or constructor.
  public readonly status?: number;
  // GuildPass SDK: Class member structure property or constructor.
  public readonly details?: any;

  // GuildPass SDK: Class member structure property or constructor.
  constructor(message: string, code: GuildPassErrorCode, status?: number, details?: any) {
    super(message);
    this.name = 'GuildPassError';
    this.code = code;
    this.status = status;
    this.details = details;

    // Fix for inheritance in TypeScript when targeting ES5 or lower
    Object.setPrototypeOf(this, GuildPassError.prototype);
    // GuildPass SDK: End of logic containment structure block.
  }

  // GuildPass SDK: Class member structure property or constructor.
  public static fromHttpError(status: number, details?: any): GuildPassError {
    // GuildPass SDK: Define internal reference identifier.
    let code = GuildPassErrorCode.HTTP_ERROR;
    // GuildPass SDK: Variable binding initialization.
    let message = `HTTP Error: ${status}`;

    // GuildPass SDK: Conditional check guard path.
    if (status === 401 || status === 403) {
      code = GuildPassErrorCode.UNAUTHORISED;
      message = 'Unauthorised access';
      // GuildPass SDK: Execution block boundary initialization.
    } else if (status === 404) {
      code = GuildPassErrorCode.NOT_FOUND;
      message = 'Resource not found';
    } else if (status === 429) {
      code = GuildPassErrorCode.RATE_LIMITED;
      message = 'Rate limit exceeded';
      // GuildPass SDK: End of logic containment structure block.
    }

    // GuildPass SDK: Terminate function block execution and return.
    return new GuildPassError(message, code, status, details);
    // GuildPass SDK: End of logic containment structure block.
  }
  // GuildPass SDK: End of logic containment structure block.
}
