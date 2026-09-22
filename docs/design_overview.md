# NFC版デジタルリレー｜簡易設計書

<aside>
✅

無料版はGPSの緯度・経度で利用でき、NFCは企業・商業施設向けの追加入力手段とする。参加者はチームを作成・参加して遊ぶ。APIの入口にはAPI Gatewayを使う。

</aside>

## 1. 目的

NFCを現実との接続点として使い、実際の場所への移動とバトンの受け渡しをつなげる。

基本機能はNFCなしでも使えるようにする。無料版では端末の位置情報APIで取得した緯度・経度を使い、NFC版ではタグに埋め込まれた緯度・経度を使う。

## 2. 基本体験

1. ユーザー名を入力する
2. チームを作成する、または参加コードでチームに参加する
3. チーム作成者は、その場でGPSまたはNFCから地点を取得し、最初のバトン地点として登録する
4. 地図で現在のバトン地点を確認する
5. GPSまたはNFCから地点の緯度・経度を取得する
6. 現在のバトン地点から100m以内なら受け取る
7. 受け取った人がそのまま次の場所へ移動する（受け取る人と次を置く人は同一人物）
8. GPSまたはNFCで次のバトン地点を登録する
9. チームの合計距離を表示する

ゲームに終了条件（ゴール・時間制限・ターン数上限）は設けない。合計距離を見ながら継続する無限リレーとする。

位置情報の利用許可は必須とする。拒否した場合はアプリを利用できない。

## 3. NFC仕様

NFCタグには地点IDではなく、緯度・経度を含むURLまたはテキストを保存する。

```
https://example.com/nfc?lat=35.000123&lng=139.000123
```

React NativeアプリがNFCのNDEFデータを読み取り、URLまたはテキストから緯度・経度を取得してサーバーへ送信する。NFCタグのハードウェアUIDや地点マスターテーブルには依存しない。

NFC非対応端末向けに、同じURLをQRコードでも用意できる。

タグ・QRコードの偽造対策は行わない。URLのドメインが自サービスのものであることの最低限の検証のみ行う。NFCタグは企業・商業施設側が緯度・経度を焼き込んで用意する想定。

## 4. システム構成

```
スマートフォンアプリ
  ├─ React Native / TypeScript
  ├─ react-native-maps（OS標準地図）
  ├─ 端末の位置情報API
  └─ NFC読み取りモジュールで緯度・経度を取得
          ↓
API Gateway（HTTP API）
          ↓
Lambda
          ↓
DynamoDB（On-Demandキャパシティ）
```

- API GatewayをすべてのAPIの入口にする
- CORSはAPI Gatewayで設定する
- 約60秒ごとにチームのゲーム状態を取得する
- 操作成功後はすぐに再取得する
- AWSの認証情報はブラウザに置かない
- MVPでは認証や不正対策を行わない。`teamId`を知っていれば誰でも該当チームのデータを操作できるが、このリスクは受け入れる
- `teamId`は推測困難なUUIDv4とする
- オフライン時（電波なし）の送信失敗はリトライ処理を実装せず、エラー表示のみ行い再試行はユーザー操作に委ねる
- 1端末は同時に1チームのみ参加できる想定とする

## 5. DynamoDB設計

チーム情報・参加コードのマッピング・チームごとのバトン履歴を、1つのテーブルで管理する。

### チーム情報

```json
{
  "PK": "TEAM#abc123",
  "SK": "META",
  "teamId": "abc123",
  "teamName": "サンプルチーム",
  "joinCode": "K7M2Q9",
  "members": ["sample-user", "another-user"],
  "createdBy": "sample-user"
}
```

`members`は文字列のList（配列）で保持する。同じチーム内で同名ユーザーが複数人いても区別・重複排除は行わない（DynamoDBのString Setは重複を自動排除してしまうため使わない）。

### 参加コードマッピング

```json
{
  "PK": "JOINCODE#K7M2Q9",
  "SK": "META",
  "joinCode": "K7M2Q9",
  "teamId": "abc123"
}
```

`joinCode`から`teamId`を引くための別アイテム。参加コードはチーム作成時に、条件付きPut（`attribute_not_exists(PK)`）でこのアイテムを作成することでグローバルな一意性を保証する。衝突した場合はコードを生成し直してリトライする。

### バトン履歴

```json
{
  "PK": "TEAM#abc123",
  "SK": "TURN#000001",
  "turnNumber": 1,
  "startLatitude": 35.000123,
  "startLongitude": 139.000123,
  "startUserName": "sample-user",
  "startInputMethod": "gps",
  "endLatitude": 35.010456,
  "endLongitude": 139.010456,
  "endUserName": "another-user",
  "endInputMethod": "nfc"
}
```

### 項目

- `teamId`：チームを識別するID（UUIDv4）
- `teamName`：チーム名
- `joinCode`：参加用コード（英数字6桁・グローバルに一意）
- `members`：検証用ユーザー名の一覧（List、重複可）
- `startLatitude` / `startLongitude`：バトンを置いた地点
- `endLatitude` / `endLongitude`：バトンを受け取った地点
- `startUserName` / `endUserName`：検証用のユーザー名
- `startInputMethod` / `endInputMethod`：`gps`または`nfc`

総距離は保存せず、チームの終了地点があるターンをフロントエンドで合計する。ユーザーテーブルやNFC地点マスターテーブルは作らない。

### 採番・排他制御

- `turnNumber`の採番：チームの最新ターンをQueryで取得して+1し、条件付きPut（`attribute_not_exists(PK) AND attribute_not_exists(SK)`）で新規ターンを作成する。衝突（同時採番）した場合はクライアント側でQueryからやり直す
- 受け取り（`receive`）の二重実行防止：条件式Update（`attribute_not_exists(endLatitude)`）を用い、既に受け取り済みのターンへの重複更新をDynamoDBレベルで防ぐ

## 6. チーム機能

### チーム作成

ユーザーがチーム名とユーザー名を入力してチームを作成する。サーバーが`teamId`（UUIDv4）と参加コード（英数字6桁）を発行する。作成直後、作成者はGPSまたはNFCで最初のバトン地点を登録する（チーム作成APIとは別操作）。

### チーム参加

ユーザーが参加コードとユーザー名を入力してチームに参加する。参加コードから`JOINCODE#`アイテムを引いて`teamId`を特定し、対象チームの`members`に追加する。

ユーザー名はUUIDではなく文字列として扱う。ログイン、本人確認、ユーザー名の一意性は保証しない。

## 7. API GatewayとAPI

API GatewayのHTTP APIからLambdaを呼び出す。Lambda Function URLは使わない。

```
POST /teams
```

チームを作成する。

```json
{
  "teamName": "サンプルチーム",
  "userName": "sample-user"
}
```

```
POST /teams/join
```

参加コードを使ってチームに参加する。

```json
{
  "joinCode": "K7M2Q9",
  "userName": "another-user"
}
```

```
GET /teams/{teamId}/turns
```

チームの全ターンを取得する。

```
POST /teams/{teamId}/turns
```

GPSまたはNFCで取得した地点を、次のバトンの開始地点として保存する。

```json
{
  "latitude": 35.000123,
  "longitude": 139.000123,
  "userName": "sample-user",
  "inputMethod": "gps"
}
```

```
POST /teams/{teamId}/turns/{turnNumber}/receive
```

GPSまたはNFCで取得した地点を、現在ターンの終了地点として保存する。GPS/NFCいずれの入力方法もこのエンドポイントに統一する（`inputMethod`で区別する）。

```json
{
  "latitude": 35.010456,
  "longitude": 139.010456,
  "userName": "another-user",
  "inputMethod": "nfc"
}
```

### エラーレスポンス

`{ "error": "TOO_FAR" }` のような簡易形式に適切なHTTPステータスコード（400番台）を添えて返す統一形式とする。

## 8. 状態判定

チームごとに最新のターンから状態を判断する。

- ターンがない：最初のバトンを置く
- 最新ターンに終了地点がない：バトンを受け取る（受け取った人がそのまま次のバトンを置く）
- 最新ターンに終了地点がある：次のバトンを置く

`status`専用項目は保存しない。

## 9. 計算処理

- 100m判定：Haversine（球面距離）で現在のバトン地点と取得地点の距離を判定する
- 各区間の距離：同じターンの`start`から`end`までをHaversineで計算する
- チームの合計距離：完了したターンの距離を合計する
- 計算は基本的にフロントエンドで行う。メンバー全員が同じ合計距離を見られるよう、ターン履歴を取得するたびに再計算する

## 10. MVPの範囲

### 実装するもの

- チーム作成
- 参加コードによるチーム参加
- ユーザー名の入力と記録
- React NativeアプリでのGPSによる地点登録
- React NativeアプリでのNFCデータによる地点登録
- 100m判定
- チームごとのバトン履歴保存
- チームの合計距離表示
- API Gateway + Lambda + DynamoDB

### 実装しないもの

- 本格的な認証
- ユーザーテーブル
- NFC地点マスターテーブル
- チーム同士の対戦
- ランキング
- 通知やチャット
- 不正利用対策（NFC/QR偽造対策、送信リトライ含む）
- ゲームの終了条件（ゴール・時間制限・ターン数上限）
- 本番運用向けの拡張設計
