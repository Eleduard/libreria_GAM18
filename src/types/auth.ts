export interface LoginCredentials {
  username: string;
  password: string;
  clientId?: string;
  clientSecret?: string;
}

export interface GamTokenRequestParams {
  grant_type: 'password';
  client_id: string;
  client_secret: string;
  scope: string;
  username: string;
  password: string;
}

export interface GamPkceSessionData {
  clientId: string;
  codeVerifier: string;
  state: string;
  redirectUri: string;
  timestamp: string;
}

export interface GamCodeExchangeParams {
  clientId: string;
  code: string;
  codeVerifier: string;
  redirectUri: string;
}

export interface GamTokenResponse {
  access_token: string;
  token_type?: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  [key: string]: unknown;
}

export interface GamUserInfo {
  guid?: string;
  username?: string;
  user_name?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  roles?: Array<{ id?: string; name?: string; [key: string]: unknown }>;
  [key: string]: unknown;
}

export interface GamErrorDetails {
  status?: number;
  statusText?: string;
  error?: string;
  error_description?: string;
  raw?: unknown;
  message?: string;
}

export interface GamCallExecutionResult {
  timestamp: string;
  endpoint: string;
  requestParams: {
    grant_type: string;
    client_id: string;
    client_secret_masked: string;
    scope: string;
    username: string;
  };
  success: boolean;
  status?: number;
  statusText?: string;
  data?: unknown;
  isCorsOrNetworkError?: boolean;
  rawError?: unknown;
}

export interface GamCodeExchangeExecutionResult {
  timestamp: string;
  endpoint: string;
  requestParams: {
    grant_type: string;
    client_id: string;
    code: string;
    redirect_uri: string;
    code_verifier: string;
  };
  success: boolean;
  status?: number;
  statusText?: string;
  data?: unknown;
  isCorsOrNetworkError?: boolean;
  rawError?: unknown;
}

export interface GamUserInfoExecutionResult {
  timestamp: string;
  endpoint: string;
  success: boolean;
  status?: number;
  statusText?: string;
  data?: unknown;
  rawError?: unknown;
}
