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
3. 地図で現在のバトン地点を確認する
4. GPSまたはNFCから地点の緯度・経度を取得する
5. 現在のバトン地点から100m以内なら受け取る
6. 次の場所へ移動する
7. GPSまたはNFCで次のバトン地点を登録する
8. チームの合計距離を表示する

## 3. NFC仕様

NFCタグには地点IDではなく、緯度・経度を含むURLまたはテキストを保存する。

```
https://example.com/nfc?lat=35.000123&lng=139.000123
```

React NativeアプリがNFCのNDEFデータを読み取り、URLまたはテキストから緯度・経度を取得してサーバーへ送信する。NFCタグのハードウェアUIDや地点マスターテーブルには依存しない。

NFC非対応端末向けに、同じURLをQRコードでも用意できる。

## 4. システム構成

```
スマートフォンアプリ
  ├─ React Native / TypeScript
  ├─ 地図表示ライブラリ
  ├─ 端末の位置情報API
  └─ NFC読み取りモジュールで緯度・経度を取得
          ↓
API Gateway（HTTP API）
          ↓
Lambda
          ↓
DynamoDB
```

- API GatewayをすべてのAPIの入口にする
- CORSはAPI Gatewayで設定する
- 約60秒ごとにチームのゲーム状態を取得する
- 操作成功後はすぐに再取得する
- AWSの認証情報はブラウザに置かない
- MVPでは認証や不正対策を行わない

## 5. DynamoDB設計

チーム情報とチームごとのバトン履歴を、1つのテーブルで管理する。

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

- `teamId`：チームを識別するID
- `teamName`：チーム名
- `joinCode`：参加用コード
- `members`：検証用ユーザー名の一覧
- `startLatitude` / `startLongitude`：バトンを置いた地点
- `endLatitude` / `endLongitude`：バトンを受け取った地点
- `startUserName` / `endUserName`：検証用のユーザー名
- `startInputMethod` / `endInputMethod`：`gps`または`nfc`

総距離は保存せず、チームの終了地点があるターンをフロントエンドで合計する。ユーザーテーブルやNFC地点マスターテーブルは作らない。

## 6. チーム機能

### チーム作成

ユーザーがチーム名とユーザー名を入力してチームを作成する。サーバーが`teamId`と参加コードを発行する。

### チーム参加

ユーザーが参加コードとユーザー名を入力してチームに参加する。

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
POST /teams/{teamId}/join
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

```
POST /teams/{teamId}/turns/{turnNumber}/receive
```

GPSまたはNFCで取得した地点を、現在ターンの終了地点として保存する。

```
POST /teams/{teamId}/nfc/touch
```

NFC URLから取得した緯度・経度を送信する。

```json
{
  "latitude": 35.010456,
  "longitude": 139.010456,
  "userName": "sample-user",
  "inputMethod": "nfc"
}
```

## 8. 状態判定

チームごとに最新のターンから状態を判断する。

- ターンがない：最初のバトンを置く
- 最新ターンに終了地点がない：バトンを受け取る
- 最新ターンに終了地点がある：次のバトンを置く

`status`専用項目は保存しない。

## 9. 計算処理

- 100m判定：現在のバトン地点と取得地点の距離で判定する
- 各区間の距離：同じターンの`start`から`end`までを計算する
- チームの合計距離：完了したターンの距離を合計する
- 計算は基本的にフロントエンドで行う

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
- 不正利用対策
- 本番運用向けの拡張設計