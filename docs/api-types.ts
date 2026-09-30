/**
 * NFC版デジタルリレー MVP - API/DBの型定義
 * docs/design_overview.md の設計に対応する。バックエンド実装が確定するまでの参照用。
 */

// ---------------------------------------------------------------------------
// 共通
// ---------------------------------------------------------------------------

export type InputMethod = "gps" | "nfc";

export interface Coordinates {
  latitude: number; // -90 〜 90
  longitude: number; // -180 〜 180
}

/** エラーコード一覧（HTTPステータスとの対応は design_overview.md §7 を参照） */
export type ApiErrorCode =
  | "VALIDATION_ERROR" // 400
  | "TOO_FAR" // 400
  | "TEAM_NOT_FOUND" // 404
  | "JOIN_CODE_NOT_FOUND" // 404
  | "TURN_NOT_FOUND" // 404
  | "TURN_IN_PROGRESS" // 409
  | "ALREADY_RECEIVED" // 409
  | "CONFLICT" // 409
  | "TEAM_FULL" // 409
  | "INTERNAL_ERROR"; // 500

export interface ApiErrorResponse {
  error: ApiErrorCode;
}

/** 入力制約（サーバーで検証。クライアントも同じ値で事前検証する） */
export const LIMITS = {
  teamNameMaxLength: 30,
  userNameMaxLength: 20,
  joinCodeLength: 6,
  maxMembers: 50,
  receiveRadiusMeters: 100,
} as const;

// ---------------------------------------------------------------------------
// D1 行（テーブル内の物理表現。カラム名は snake_case）
// ---------------------------------------------------------------------------

export interface TeamRow {
  team_id: string; // UUIDv4
  team_name: string;
  join_code: string; // 英数字6桁（大文字）
  members: string; // JSON文字列（string[]）。読み出し時に JSON.parse する
  created_by: string;
  created_at: number; // Unix ms
}

export interface TurnRow {
  team_id: string;
  turn_number: number; // 1始まりの連番
  start_latitude: number;
  start_longitude: number;
  start_user_name: string;
  start_input_method: InputMethod;
  start_at: number; // Unix ms
  end_latitude: number | null;
  end_longitude: number | null;
  end_user_name: string | null;
  end_input_method: InputMethod | null;
  end_at: number | null; // Unix ms
}

// ---------------------------------------------------------------------------
// ドメインモデル（API応答で使う形。camelCase、DBの補助カラムは含まない）
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
  endLatitude?: number; // 受け取り前は省略
  endLongitude?: number;
  endUserName?: string;
  endInputMethod?: InputMethod;
}

// ---------------------------------------------------------------------------
// POST /teams - チーム作成（201）
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
// POST /teams/join - 参加コードでチーム参加（200）
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
// GET /teams/{teamId}/turns?since={turnNumber} - ターン取得（200）
// since 省略時は全ターン。指定時は turnNumber >= since のみ。
// ---------------------------------------------------------------------------

export interface GetTurnsResponse {
  turns: Turn[]; // turnNumber 昇順
}

// ---------------------------------------------------------------------------
// POST /teams/{teamId}/turns - 次のバトンの開始地点を登録（201）
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
// POST /teams/{teamId}/turns/{turnNumber}/receive - バトンを受け取る（200）
// ---------------------------------------------------------------------------

export interface ReceiveTurnRequest extends Coordinates {
  userName: string;
  inputMethod: InputMethod;
}

/** 受け取り後のターン全体（end* が埋まっている） */
export interface ReceiveTurnResponse extends Turn {}

// ---------------------------------------------------------------------------
// GET /health（200）
// ---------------------------------------------------------------------------

export interface HealthResponse {
  ok: true;
}

// ---------------------------------------------------------------------------
// 計算ロジック（フロントエンド）: design_overview.md §9
// 区間距離 = ターンN の end → ターンN+1 の start
// ---------------------------------------------------------------------------

export function totalDistanceMeters(
  turns: Turn[],
  haversine: (a: Coordinates, b: Coordinates) => number,
): number {
  let total = 0;
  for (let i = 0; i < turns.length - 1; i++) {
    const cur = turns[i];
    const next = turns[i + 1];
    if (cur.endLatitude === undefined || cur.endLongitude === undefined) continue;
    total += haversine(
      { latitude: cur.endLatitude, longitude: cur.endLongitude },
      { latitude: next.startLatitude, longitude: next.startLongitude },
    );
  }
  return total;
}
