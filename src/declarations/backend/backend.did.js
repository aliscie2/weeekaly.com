export const idlFactory = ({ IDL }) => {
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
  const Result = IDL.Variant({
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
  const Result_1 = IDL.Variant({ 'Ok' : IDL.Null, 'Err' : IDL.Text });
  const PrepareDelegationRequest = IDL.Record({
    'provider' : IDL.Text,
    'origin' : IDL.Text,
    'targets' : IDL.Opt(IDL.Vec(IDL.Principal)),
    'max_time_to_live' : IDL.Nat64,
    'session_public_key' : IDL.Vec(IDL.Nat8),
    'id_token' : IDL.Text,
  });
  const PrepareDelegationResponse = IDL.Record({ 'expire_at' : IDL.Nat64 });
  const Result_2 = IDL.Variant({
    'Ok' : PrepareDelegationResponse,
    'Err' : IDL.Text,
  });
  return IDL.Service({
    'cleanup_expired_sessions' : IDL.Func([], [IDL.Nat64], []),
    'get_caller' : IDL.Func([], [IDL.Text], ['query']),
    'get_delegation' : IDL.Func([GetDelegationRequest], [Result], ['query']),
    'get_providers' : IDL.Func([], [IDL.Vec(OAuthProvider)], ['query']),
    'get_session_count' : IDL.Func([], [IDL.Nat64], ['query']),
    'get_user_info' : IDL.Func([], [UserInfo], ['query']),
    'greet' : IDL.Func([IDL.Text], [IDL.Text], ['query']),
    'hello_world' : IDL.Func([], [IDL.Text], ['query']),
    'is_authenticated' : IDL.Func([], [IDL.Bool], ['query']),
    'logout' : IDL.Func([IDL.Vec(IDL.Nat8)], [Result_1], []),
    'prepare_delegation' : IDL.Func([PrepareDelegationRequest], [Result_2], []),
  });
};
export const init = ({ IDL }) => { return []; };
