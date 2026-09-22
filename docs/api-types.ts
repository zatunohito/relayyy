/**
 * NFC版デジタルリレー MVP - API/DBの型定義
 * docs/design_overview.md の設計に対応する。バックエンド実装が確定するまでの参照用。
 */

// ---------------------------------------------------------------------------
// 共通
// ---------------------------------------------------------------------------

export type InputMethod = "gps" | "nfc";

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface ApiErrorResponse {
  error: string;
}

// ---------------------------------------------------------------------------
// DynamoDB アイテム（テーブル内の物理表現）
// ---------------------------------------------------------------------------

export interface TeamItem {
  PK: `TEAM#${string}`;
  SK: "META";
  teamId: string;
  teamName: string;
  joinCode: string;
  members: string[];
  createdBy: string;
}

export interface JoinCodeItem {
  PK: `JOINCODE#${string}`;
  SK: "META";
  joinCode: string;
  teamId: string;
}

export interface TurnItem {
  PK: `TEAM#${string}`;
  SK: `TURN#${string}`; // ゼロ埋め連番、例: "TURN#000001"
  turnNumber: number;
  startLatitude: number;
  startLongitude: number;
  startUserName: string;
  startInputMethod: InputMethod;
  endLatitude?: number;
  endLongitude?: number;
  endUserName?: string;
  endInputMethod?: InputMethod;
}

// ---------------------------------------------------------------------------
// ドメインモデル（API応答で使うDynamoDBキーを含まない形）
// ---------------------------------------------------------------------------

export interface Team {
  teamId: string;
  teamName: string;
  joinCode: string;
  members: string[];
  createdBy: string;
}

export interface Turn {
  turnNumber: number;
  startLatitude: number;
  startLongitude: number;
  startUserName: string;
  startInputMethod: InputMethod;
  endLatitude?: number;
  endLongitude?: number;
  endUserName?: string;
  endInputMethod?: InputMethod;
}

// ---------------------------------------------------------------------------
// POST /teams - チーム作成
// ---------------------------------------------------------------------------

export interface CreateTeamRequest {
  teamName: string;
  userName: string;
}

export interface CreateTeamResponse {
  teamId: string;
  teamName: string;
  joinCode: string;
}

// ---------------------------------------------------------------------------
// POST /teams/join - 参加コードでチーム参加
// ---------------------------------------------------------------------------

export interface JoinTeamRequest {
  joinCode: string;
  userName: string;
}

export interface JoinTeamResponse {
  teamId: string;
  teamName: string;
  members: string[];
}

// ---------------------------------------------------------------------------
// GET /teams/{teamId}/turns - チームの全ターン取得
// ---------------------------------------------------------------------------

export interface GetTurnsResponse {
  turns: Turn[];
}

// ---------------------------------------------------------------------------
// POST /teams/{teamId}/turns - 次のバトンの開始地点を登録
// ---------------------------------------------------------------------------

export interface CreateTurnRequest extends Coordinates {
  userName: string;
  inputMethod: InputMethod;
}

export interface CreateTurnResponse {
  turnNumber: number;
  startLatitude: number;
  startLongitude: number;
  startUserName: string;
  startInputMethod: InputMethod;
}

// ---------------------------------------------------------------------------
// POST /teams/{teamId}/turns/{turnNumber}/receive - バトンを受け取る
// ---------------------------------------------------------------------------

export interface ReceiveTurnRequest extends Coordinates {
  userName: string;
  inputMethod: InputMethod;
}

export interface ReceiveTurnResponse extends Turn {}
