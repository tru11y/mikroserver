export class AuthFailedException extends Error {
  constructor(message = "Identifiants RouterOS incorrects") {
    super(message);
    this.name = "AuthFailedException";
  }
}

export class UnreachableException extends Error {
  constructor(message = "Routeur injoignable") {
    super(message);
    this.name = "UnreachableException";
  }
}

export class ApiException extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
    this.name = "ApiException";
  }
}

export class RestNotSupportedException extends Error {
  constructor(message = "REST API non disponible (RouterOS < 7.1)") {
    super(message);
    this.name = "RestNotSupportedException";
  }
}
