 * nsutilsがインストールされているNetscape 7がある場合、NC4.x形式の
   アドレス帳のインポートまで自動化します。
 * "extensions.nc4migrator.override.<上書きしたい設定名>" という設定を
   作成しておくと、設定の移行時にその値で上書きします。
   例えば
   pref("extensions.nc4migrator.override.mail.server.*.empty_trash_on_exit", true);
   としておくと、移行前の設定がどうであったかに関わらず、すべての受信サーバで
   ごみ箱を自動的に空にするようになります。
   値を文字列で「[[CLEAR]]」としておくと、その名前のユーザ設定の値を削除します。
