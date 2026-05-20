export class ValidationError extends Error {
  readonly code = 'VALIDATION_ERROR';
  constructor(
    message: string,
    /** Path to the offending field (e.g. 'metrics[0]', 'filters[1].operator') */
    readonly field?: string
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}
