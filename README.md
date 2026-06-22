# ColorRatio

ColorRatioは、Adobe Illustratorで選択したオブジェクトの色成分に係数を掛けるCEPエクステンションです。

## 主な機能

- 係数の数値入力とプリセット（10%、50%、150%、200%）
- RGB、CMYK、Gray、スポットカラーの処理
- R/G/B/C/M/Y/Kの個別チャンネル指定
- 塗り、線、テキスト、線形・円形グラデーション停止色への適用
- 未対応オブジェクトや複雑なアートワークを保護するスキップ処理

計算式は `変更後の値 = 現在値 × 係数` です。RGBは0–255、CMYK・Gray・スポットカラーの濃度は0–100に制限されます。

## 動作環境

- Adobe Illustrator 2020（24.0）以降
- macOS

CEPおよびUPIAの提供状況はIllustratorとCreative Cloudのバージョンに依存します。

## インストール

1. [GitHub Releases](../../releases)から `ColorRatio-<version>.zxp` をダウンロードします。
2. Adobe Unified Plugin Installer Agent（UPIA）でZXPをインストールします。
3. Illustratorを再起動します。
4. `ウィンドウ > エクステンション > カラー係数` を開きます。

macOSでUPIAを直接実行する場合:

```bash
UPIA="/Library/Application Support/Adobe/Adobe Desktop Common/RemoteComponents/UPI/UnifiedPluginInstallerAgent/UnifiedPluginInstallerAgent.app/Contents/MacOS/UnifiedPluginInstallerAgent"
"$UPIA" --install "/path/to/ColorRatio-1.0.1.zxp"
```

## 使い方

1. Illustrator上でオブジェクトを選択します。
2. 係数を入力するか、プリセットを選びます。
3. 色空間と、必要に応じて個別チャンネルを選びます。
4. 塗り、線、テキストなどの対象を選びます。
5. `適用`をクリックします。

## 制限事項

- アピアランスパネルの複数の塗り・線・効果は完全には走査しません。
- パターン、画像、メッシュ、ライブペイント、フリーグラデーション、複雑なテキスト範囲は対象外です。
- IllustratorのExtendScriptではフリーグラデーションが`GrayColor(0)`として見える場合があります。データ破損を避けるため、`GrayColor(0)`のPathItemの塗りは通常のグレースケール黒を含めてスキップします。
- 停止色が64個を超える線形・円形グラデーションはスキップします。
- 同じグラデーション定義は1回の操作につき一度だけ処理します。
- CMYKではインク成分の値に係数を掛けます。RGBの明るさ調整とは結果が異なります。

重要なファイルで作業する前に、Illustratorドキュメントのバックアップを作成してください。

## 開発

ローカル開発では、`cep/`を次の場所に配置するかシンボリックリンクを作成します。

```text
~/Library/Application Support/Adobe/CEP/extensions/ColorRatio
```

未署名エクステンションの実行にはCEPのPlayerDebugMode設定が必要です。

### パッケージ作成

Adobe `ZXPSignCmd`、署名証明書、パスワードファイルを用意します。既定の参照先は次のとおりです。

```text
~/CEP-Resources/ZXPSignCMD/4.1.3/macOS/ZXPSignCmd
signing/ColorRatio.p12
signing/.p12-password
```

```bash
./scripts/package.sh 1.0.1
```

生成したZXPは`dist/`に出力され、署名検証とSHA-256の表示まで行われます。パスは環境変数`ZXP_SIGN_CMD`、`COLORRATIO_CERTIFICATE`、`COLORRATIO_PASSWORD_FILE`で変更できます。

`signing/`と`dist/`はGitの追跡対象外です。証明書やパスワードをコミットしないでください。

### 署名証明書の管理

- `ColorRatio.p12`と`.p12-password`を暗号化された保管先へ一緒にバックアップしてください。
- 証明書とパスワードをGitHub、公開クラウド、メールへ添付しないでください。
- 更新版も同じ証明書で署名できるよう、秘密鍵を紛失しないでください。
- 自己署名証明書はパッケージの同一署名者を示しますが、第三者機関による本人確認を意味しません。
- 秘密鍵が漏えいした場合は使用を中止し、新しい証明書へ切り替えて利用者へ告知してください。

## コントリビューション

不具合報告や改善提案はIssuesへお願いします。変更を提案する場合は[CONTRIBUTING.md](CONTRIBUTING.md)を参照してください。

## ライセンス

[MIT License](LICENSE)
