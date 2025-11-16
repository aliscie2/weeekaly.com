export const idlFactory = ({ IDL }) => {
  const BusyTimeBlock = IDL.Record({
    'end_time' : IDL.Nat64,
    'start_time' : IDL.Nat64,
  });
  const TimeSlot = IDL.Record({
    'end_time' : IDL.Nat16,
    'start_time' : IDL.Nat16,
    'day_of_week' : IDL.Nat8,
  });
  const CreateAvailabilityRequest = IDL.Record({
    'timezone' : IDL.Text,
    'title' : IDL.Text,
    'description' : IDL.Text,
    'owner_email' : IDL.Opt(IDL.Text),
    'busy_times' : IDL.Opt(IDL.Vec(BusyTimeBlock)),
    'slots' : IDL.Vec(TimeSlot),
    'owner_name' : IDL.Opt(IDL.Text),
  });
  const Availability = IDL.Record({
    'id' : IDL.Text,
    'timezone' : IDL.Text,
    'title' : IDL.Text,
    'updated_at' : IDL.Nat64,
    'owner' : IDL.Principal,
    'description' : IDL.Text,
    'owner_email' : IDL.Opt(IDL.Text),
    'created_at' : IDL.Nat64,
    'busy_times' : IDL.Opt(IDL.Vec(BusyTimeBlock)),
    'is_favorite' : IDL.Bool,
    'slots' : IDL.Vec(TimeSlot),
    'display_order' : IDL.Nat32,
    'owner_name' : IDL.Opt(IDL.Text),
  });
  const Result = IDL.Variant({ 'Ok' : Availability, 'Err' : IDL.Text });
  const CreateEventRequest = IDL.Record({
    'timezone' : IDL.Text,
    'description' : IDL.Opt(IDL.Text),
    'end_time' : IDL.Text,
    'summary' : IDL.Text,
    'start_time' : IDL.Text,
    'attendees' : IDL.Opt(IDL.Vec(IDL.Text)),
    'conference_data' : IDL.Opt(IDL.Bool),
    'location' : IDL.Opt(IDL.Text),
  });
  const Result_1 = IDL.Variant({ 'Ok' : IDL.Text, 'Err' : IDL.Text });
  const Result_2 = IDL.Variant({ 'Ok' : IDL.Null, 'Err' : IDL.Text });
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
  const Result_3 = IDL.Variant({ 'Ok' : TokenResponse, 'Err' : IDL.Text });
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
  const Result_4 = IDL.Variant({
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
  const PrepareDelegationRequest = IDL.Record({
    'provider' : IDL.Text,
    'origin' : IDL.Text,
    'targets' : IDL.Opt(IDL.Vec(IDL.Principal)),
    'max_time_to_live' : IDL.Nat64,
    'session_public_key' : IDL.Vec(IDL.Nat8),
    'id_token' : IDL.Text,
  });
  const PrepareDelegationResponse = IDL.Record({ 'expire_at' : IDL.Nat64 });
  const Result_5 = IDL.Variant({
    'Ok' : PrepareDelegationResponse,
    'Err' : IDL.Text,
  });
  const RefreshTokenRequest = IDL.Record({ 'refresh_token' : IDL.Text });
  const UpdateAvailabilityRequest = IDL.Record({
    'id' : IDL.Text,
    'timezone' : IDL.Opt(IDL.Text),
    'title' : IDL.Opt(IDL.Text),
    'description' : IDL.Opt(IDL.Text),
    'slots' : IDL.Opt(IDL.Vec(TimeSlot)),
  });
  const UpdateEventRequest = IDL.Record({
    'status' : IDL.Opt(IDL.Text),
    'timezone' : IDL.Opt(IDL.Text),
    'description' : IDL.Opt(IDL.Text),
    'end_time' : IDL.Opt(IDL.Text),
    'summary' : IDL.Opt(IDL.Text),
    'start_time' : IDL.Opt(IDL.Text),
    'attendees' : IDL.Opt(IDL.Vec(IDL.Text)),
    'event_id' : IDL.Text,
    'location' : IDL.Opt(IDL.Text),
  });
  return IDL.Service({
    'cleanup_expired_sessions' : IDL.Func([], [IDL.Nat64], []),
    'create_availability' : IDL.Func([CreateAvailabilityRequest], [Result], []),
    'create_calendar_event' : IDL.Func([CreateEventRequest], [Result_1], []),
    'delete_availability' : IDL.Func([IDL.Text], [Result_2], []),
    'delete_calendar_event' : IDL.Func([IDL.Text], [Result_2], []),
    'exchange_oauth_code' : IDL.Func([ExchangeCodeRequest], [Result_3], []),
    'get_availability' : IDL.Func([IDL.Text], [Result], ['query']),
    'get_caller' : IDL.Func([], [IDL.Text], ['query']),
    'get_delegation' : IDL.Func([GetDelegationRequest], [Result_4], ['query']),
    'get_providers' : IDL.Func([], [IDL.Vec(OAuthProvider)], ['query']),
    'get_session_count' : IDL.Func([], [IDL.Nat64], ['query']),
    'get_user_info' : IDL.Func([], [UserInfo], ['query']),
    'greet' : IDL.Func([IDL.Text], [IDL.Text], ['query']),
    'hello_world' : IDL.Func([], [IDL.Text], ['query']),
    'is_authenticated' : IDL.Func([], [IDL.Bool], ['query']),
    'list_user_availabilities' : IDL.Func(
        [],
        [IDL.Vec(Availability)],
        ['query'],
      ),
    'logout' : IDL.Func([IDL.Vec(IDL.Nat8)], [Result_2], []),
    'prepare_delegation' : IDL.Func([PrepareDelegationRequest], [Result_5], []),
    'refresh_google_token' : IDL.Func([RefreshTokenRequest], [Result_3], []),
    'regenerate_availability_id' : IDL.Func([IDL.Text], [Result_1], []),
    'search_availabilities_by_email' : IDL.Func(
        [IDL.Text],
        [IDL.Vec(Availability)],
        ['query'],
      ),
    'search_availabilities_by_principal' : IDL.Func(
        [IDL.Principal],
        [IDL.Vec(Availability)],
        ['query'],
      ),
    'search_availabilities_by_username' : IDL.Func(
        [IDL.Text],
        [IDL.Vec(Availability)],
        ['query'],
      ),
    'search_by_emails' : IDL.Func(
        [IDL.Vec(IDL.Text)],
        [IDL.Vec(IDL.Vec(Availability))],
        ['query'],
      ),
    'search_by_usernames' : IDL.Func(
        [IDL.Vec(IDL.Text)],
        [IDL.Vec(IDL.Vec(Availability))],
        ['query'],
      ),
    'set_favorite_availability' : IDL.Func([IDL.Text], [Result_2], []),
    'update_availability' : IDL.Func([UpdateAvailabilityRequest], [Result], []),
    'update_availability_busy_times' : IDL.Func(
        [IDL.Text, IDL.Vec(BusyTimeBlock)],
        [Result_2],
        [],
      ),
    'update_calendar_event' : IDL.Func([UpdateEventRequest], [Result_1], []),
  });
};
export const init = ({ IDL }) => { return []; };
