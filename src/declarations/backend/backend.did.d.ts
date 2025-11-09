import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';
import type { IDL } from '@dfinity/candid';

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
export type Result = { 'Ok' : string } |
  { 'Err' : string };
export type Result_1 = { 'Ok' : null } |
  { 'Err' : string };
export type Result_2 = { 'Ok' : TokenResponse } |
  { 'Err' : string };
export type Result_3 = { 'Ok' : GetDelegationResponse } |
  { 'Err' : string };
export type Result_4 = { 'Ok' : PrepareDelegationResponse } |
  { 'Err' : string };
export interface SignedDelegation {
  'signature' : Uint8Array | number[],
  'delegation' : Delegation,
}
export interface TokenResponse {
  'access_token' : string,
  'refresh_token' : [] | [string],
  'expires_in' : bigint,
  'token_type' : string,
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
  'create_calendar_event' : ActorMethod<[CreateEventRequest], Result>,
  'delete_calendar_event' : ActorMethod<[string], Result_1>,
  'exchange_oauth_code' : ActorMethod<[ExchangeCodeRequest], Result_2>,
  'get_caller' : ActorMethod<[], string>,
  'get_delegation' : ActorMethod<[GetDelegationRequest], Result_3>,
  'get_providers' : ActorMethod<[], Array<OAuthProvider>>,
  'get_session_count' : ActorMethod<[], bigint>,
  'get_user_info' : ActorMethod<[], UserInfo>,
  'greet' : ActorMethod<[string], string>,
  'hello_world' : ActorMethod<[], string>,
  'is_authenticated' : ActorMethod<[], boolean>,
  'logout' : ActorMethod<[Uint8Array | number[]], Result_1>,
  'prepare_delegation' : ActorMethod<[PrepareDelegationRequest], Result_4>,
  'refresh_google_token' : ActorMethod<[RefreshTokenRequest], Result_2>,
  'update_calendar_event' : ActorMethod<[UpdateEventRequest], Result>,
}
export declare const idlFactory: IDL.InterfaceFactory;
export declare const init: (args: { IDL: typeof IDL }) => IDL.Type[];
