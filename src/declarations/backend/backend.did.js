export const idlFactory = ({ IDL }) => {
  const ExchangeCodeRequest = IDL.Record({
    'code_verifier' : IDL.Text,
    'redirect_uri' : IDL.Text,
    'code' : IDL.Text,
  });
  const TokenResponse = IDL.Record({
    'access_token' : IDL.Text,
    'refresh_token' : IDL.Opt(IDL.Text),
    'expires_in' : IDL.Nat64,
    'token_type' : IDL.Text,
  });
  const Result = IDL.Variant({ 'Ok' : TokenResponse, 'Err' : IDL.Text });
  const GetDelegationRequest = IDL.Record({
    'expire_at' : IDL.Nat64,
    'provider' : IDL.Text,
    'origin' : IDL.Text,
    'targets' : IDL.Opt(IDL.Vec(IDL.Principal)),
    'session_public_key' : IDL.Vec(IDL.Nat8),
  });
  const Delegation = IDL.Record({
    'pubkey' : IDL.Vec(IDL.Nat8),
    'targets' : IDL.Opt(IDL.Vec(IDL.Principal)),
    'expiration' : IDL.Nat64,
  });
  const SignedDelegation = IDL.Record({
    'signature' : IDL.Vec(IDL.Nat8),
    'delegation' : Delegation,
  });
  const GetDelegationResponse = IDL.Record({
    'signed_delegation' : SignedDelegation,
    'user_canister_pubkey' : IDL.Vec(IDL.Nat8),
  });
  const Result_1 = IDL.Variant({
    'Ok' : GetDelegationResponse,
    'Err' : IDL.Text,
  });
  const OAuthProvider = IDL.Record({
    'response_type' : IDL.Text,
    'authorization_url' : IDL.Text,
    'name' : IDL.Text,
    'scope' : IDL.Text,
    'token_url' : IDL.Text,
    'client_id' : IDL.Text,
  });
  const UserInfo = IDL.Record({
    'principal' : IDL.Text,
    'name' : IDL.Opt(IDL.Text),
    'user_id' : IDL.Opt(IDL.Text),
    'email' : IDL.Opt(IDL.Text),
  });
  const Result_2 = IDL.Variant({ 'Ok' : IDL.Null, 'Err' : IDL.Text });
  const PrepareDelegationRequest = IDL.Record({
    'provider' : IDL.Text,
    'origin' : IDL.Text,
    'targets' : IDL.Opt(IDL.Vec(IDL.Principal)),
    'max_time_to_live' : IDL.Nat64,
    'session_public_key' : IDL.Vec(IDL.Nat8),
    'id_token' : IDL.Text,
  });
  const PrepareDelegationResponse = IDL.Record({ 'expire_at' : IDL.Nat64 });
  const Result_3 = IDL.Variant({
    'Ok' : PrepareDelegationResponse,
    'Err' : IDL.Text,
  });
  const RefreshTokenRequest = IDL.Record({ 'refresh_token' : IDL.Text });
  return IDL.Service({
    'cleanup_expired_sessions' : IDL.Func([], [IDL.Nat64], []),
    'exchange_oauth_code' : IDL.Func([ExchangeCodeRequest], [Result], []),
    'get_caller' : IDL.Func([], [IDL.Text], ['query']),
    'get_delegation' : IDL.Func([GetDelegationRequest], [Result_1], ['query']),
    'get_providers' : IDL.Func([], [IDL.Vec(OAuthProvider)], ['query']),
    'get_session_count' : IDL.Func([], [IDL.Nat64], ['query']),
    'get_user_info' : IDL.Func([], [UserInfo], ['query']),
    'greet' : IDL.Func([IDL.Text], [IDL.Text], ['query']),
    'hello_world' : IDL.Func([], [IDL.Text], ['query']),
    'is_authenticated' : IDL.Func([], [IDL.Bool], ['query']),
    'logout' : IDL.Func([IDL.Vec(IDL.Nat8)], [Result_2], []),
    'prepare_delegation' : IDL.Func([PrepareDelegationRequest], [Result_3], []),
    'refresh_google_token' : IDL.Func([RefreshTokenRequest], [Result], []),
  });
};
export const init = ({ IDL }) => { return []; };
