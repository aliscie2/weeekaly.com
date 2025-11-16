import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';
import type { IDL } from '@dfinity/candid';

export interface Availability {
  'id' : string,
  'timezone' : string,
  'title' : string,
  'updated_at' : bigint,
  'owner' : Principal,
  'description' : string,
  'owner_email' : [] | [string],
  'created_at' : bigint,
  'busy_times' : [] | [Array<BusyTimeBlock>],
  'is_favorite' : boolean,
  'slots' : Array<TimeSlot>,
  'display_order' : number,
  'owner_name' : [] | [string],
}
export interface BusyTimeBlock { 'end_time' : bigint, 'start_time' : bigint }
export interface CreateAvailabilityRequest {
  'timezone' : string,
  'title' : string,
  'description' : string,
  'owner_email' : [] | [string],
  'busy_times' : [] | [Array<BusyTimeBlock>],
  'slots' : Array<TimeSlot>,
  'owner_name' : [] | [string],
}
export interface CreateEventRequest {
  'timezone' : string,
  'description' : [] | [string],
  'end_time' : string,
  'summary' : string,
  'start_time' : string,
  'attendees' : [] | [Array<string>],
  'conference_data' : [] | [boolean],
  'location' : [] | [string],
}
export interface Delegation {
  'pubkey' : Uint8Array | number[],
  'targets' : [] | [Array<Principal>],
  'expiration' : bigint,
}
export interface ExchangeCodeRequest {
  'code_verifier' : string,
  'redirect_uri' : string,
  'code' : string,
}
export interface GetDelegationRequest {
  'expire_at' : bigint,
  'provider' : string,
  'origin' : string,
  'targets' : [] | [Array<Principal>],
  'session_public_key' : Uint8Array | number[],
}
export interface GetDelegationResponse {
  'signed_delegation' : SignedDelegation,
  'user_canister_pubkey' : Uint8Array | number[],
}
export interface OAuthProvider {
  'response_type' : string,
  'authorization_url' : string,
  'name' : string,
  'scope' : string,
  'token_url' : string,
  'client_id' : string,
}
export interface PrepareDelegationRequest {
  'provider' : string,
  'origin' : string,
  'targets' : [] | [Array<Principal>],
  'max_time_to_live' : bigint,
  'session_public_key' : Uint8Array | number[],
  'id_token' : string,
}
export interface PrepareDelegationResponse { 'expire_at' : bigint }
export interface RefreshTokenRequest { 'refresh_token' : string }
export type Result = { 'Ok' : Availability } |
  { 'Err' : string };
export type Result_1 = { 'Ok' : string } |
  { 'Err' : string };
export type Result_2 = { 'Ok' : null } |
  { 'Err' : string };
export type Result_3 = { 'Ok' : TokenResponse } |
  { 'Err' : string };
export type Result_4 = { 'Ok' : GetDelegationResponse } |
  { 'Err' : string };
export type Result_5 = { 'Ok' : PrepareDelegationResponse } |
  { 'Err' : string };
export interface SignedDelegation {
  'signature' : Uint8Array | number[],
  'delegation' : Delegation,
}
export interface TimeSlot {
  'end_time' : number,
  'start_time' : number,
  'day_of_week' : number,
}
export interface TokenResponse {
  'access_token' : string,
  'refresh_token' : [] | [string],
  'expires_in' : bigint,
  'token_type' : string,
}
export interface UpdateAvailabilityRequest {
  'id' : string,
  'timezone' : [] | [string],
  'title' : [] | [string],
  'description' : [] | [string],
  'slots' : [] | [Array<TimeSlot>],
}
export interface UpdateEventRequest {
  'status' : [] | [string],
  'timezone' : [] | [string],
  'description' : [] | [string],
  'end_time' : [] | [string],
  'summary' : [] | [string],
  'start_time' : [] | [string],
  'attendees' : [] | [Array<string>],
  'event_id' : string,
  'location' : [] | [string],
}
export interface UserInfo {
  'principal' : string,
  'name' : [] | [string],
  'user_id' : [] | [string],
  'email' : [] | [string],
}
export interface _SERVICE {
  'cleanup_expired_sessions' : ActorMethod<[], bigint>,
  'create_availability' : ActorMethod<[CreateAvailabilityRequest], Result>,
  'create_calendar_event' : ActorMethod<[CreateEventRequest], Result_1>,
  'delete_availability' : ActorMethod<[string], Result_2>,
  'delete_calendar_event' : ActorMethod<[string], Result_2>,
  'exchange_oauth_code' : ActorMethod<[ExchangeCodeRequest], Result_3>,
  'get_availability' : ActorMethod<[string], Result>,
  'get_caller' : ActorMethod<[], string>,
  'get_delegation' : ActorMethod<[GetDelegationRequest], Result_4>,
  'get_providers' : ActorMethod<[], Array<OAuthProvider>>,
  'get_session_count' : ActorMethod<[], bigint>,
  'get_user_info' : ActorMethod<[], UserInfo>,
  'greet' : ActorMethod<[string], string>,
  'hello_world' : ActorMethod<[], string>,
  'is_authenticated' : ActorMethod<[], boolean>,
  'list_user_availabilities' : ActorMethod<[], Array<Availability>>,
  'logout' : ActorMethod<[Uint8Array | number[]], Result_2>,
  'prepare_delegation' : ActorMethod<[PrepareDelegationRequest], Result_5>,
  'refresh_google_token' : ActorMethod<[RefreshTokenRequest], Result_3>,
  'regenerate_availability_id' : ActorMethod<[string], Result_1>,
  'search_availabilities_by_email' : ActorMethod<[string], Array<Availability>>,
  'search_availabilities_by_principal' : ActorMethod<
    [Principal],
    Array<Availability>
  >,
  'search_availabilities_by_username' : ActorMethod<
    [string],
    Array<Availability>
  >,
  'search_by_emails' : ActorMethod<[Array<string>], Array<Array<Availability>>>,
  'search_by_usernames' : ActorMethod<
    [Array<string>],
    Array<Array<Availability>>
  >,
  'set_favorite_availability' : ActorMethod<[string], Result_2>,
  'update_availability' : ActorMethod<[UpdateAvailabilityRequest], Result>,
  'update_availability_busy_times' : ActorMethod<
    [string, Array<BusyTimeBlock>],
    Result_2
  >,
  'update_calendar_event' : ActorMethod<[UpdateEventRequest], Result_1>,
}
export declare const idlFactory: IDL.InterfaceFactory;
export declare const init: (args: { IDL: typeof IDL }) => IDL.Type[];
