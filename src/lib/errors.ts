/**
 * Expected problems the agent can act on. Their message is safe to show as is.
 * Anything that is not a DomainError is treated as a bug and hidden behind a generic message.
 */
export class DomainError extends Error {
  constructor(
    message: string,
    readonly code: "NOT_FOUND" | "VALIDATION" | "CONFLICT",
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class NotFoundError extends DomainError {
  constructor(what: string, id: number) {
    super(`${what} ${id} not found.`, "NOT_FOUND");
  }
}

export class ValidationError extends DomainError {
  constructor(message: string) {
    super(message, "VALIDATION");
  }
}

export class ConflictError extends DomainError {
  constructor(message: string) {
    super(message, "CONFLICT");
  }
}
