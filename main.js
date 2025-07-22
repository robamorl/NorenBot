// ======================================================================
// 初期処理
// ======================================================================
// モジュールのインポート
const http = require("http");
const axios = require("axios");
const discord = require("discord.js");

// コマンド定数
const COMMAND_NOREN_DELETE = "消して";

let client = null;

// ======================================================================
// ディスコード接続処理
// ======================================================================
const connectDiscord = () => {
  if (client == null) {
    // clientがnullならインスタンス作成
    writeLog("Create Client.");
    client = new discord.Client({
      intents: [
        discord.GatewayIntentBits.Guilds,
        discord.GatewayIntentBits.GuildMessages,
        discord.GatewayIntentBits.GuildMessageReactions,
        discord.GatewayIntentBits.MessageContent,
      ],
    });
  } else {
    // clientがあるなら状態に応じて処理
    if (client.readyAt != null) {
      switch (client.status) {
        case 0: // READY
        case 1: // CONNECTING
        case 2: // RECONNECTING
        case 3: // IDLE
        case 4: // NEARLY
          return;
        case 5: // DISCONNECTED
          writeLog("Destroy Client.");
          client.destroy();
          break;
        default:
          writeLog("Create Client(by client instance not null).");
          client = new discord.Client({
            intents: [
              discord.GatewayIntentBits.Guilds,
              discord.GatewayIntentBits.GuildMessages,
              discord.GatewayIntentBits.GuildMessageReactions,
              discord.GatewayIntentBits.MessageContent,
            ],
          });
          break;
      }
    }
  }

  // ログイン処理
  writeLog("login currently running...");
  client.login(process.env.DISCORD_BOT_TOKEN);

  // debug
  client.on("debug", (info) => {
    writeLog("debug: " + info);
  });

  if (client.isReady()) {
    // すでにログイン済みならログ出力
    writeLog("logined already.");
  } else {
    // ログイン処理中ならログ出力
    writeLog("login process started.");
  }
  // 待機状態になったらログ出力
  client.on("ready", () => {
    writeLog("login success. [" + client.readyAt + "]");
    writeLog("bot is ready!")
  });
  // 接続状態の変化をログ出力
  client.on("reconnecting", () => {
    writeLog("bot is reconnecting...");
  });
  // 切断状態になったらログ出力
  client.on("disconnect", () => {
    writeLog("bot is disconnected.");
  });
  // エラー検出時にログ出力
  client.on("error", (error) => {
    writeLog("bot error detected.");
    writeLog("Error: " + error.message);
  });

  // GASへPOSTする関数を実行
  client.on("messageCreate", (message) => {
    writeLog("messageCreate event detected.");
    // コマンドの判定
    let isBotCommand =
      !message.author.bot &&
      message.mentions.has(client.user, {
        ignoreEveryone: true,
        ignoreHere: true,
      });
    if (isBotCommand && message.type != discord.MessageType.Reply) {
      // ----------------------------------------
      // 暖簾生成コマンド
      // ----------------------------------------
      operateNoren(message);
    } else if (
      isBotCommand &&
      message.type == discord.MessageType.Reply &&
      message.content == COMMAND_NOREN_DELETE
    ) {
      // ----------------------------------------
      // 暖簾削除コマンド
      // ----------------------------------------
      // 暖簾削除処理判定
      const judgeNorenDelete = async (isBotCommand, message) => {
        // リプライの前のメッセージを取得(のれん本体のはず)
        await message.channel.messages
          .fetch(message.reference.messageId)
          .then((sourceMessage) => {
            // コマンド発行元ユーザ
            let commandIssuingUserId = message.author.id;
            // 暖簾生成元ユーザを特定
            let createIssuingUserId = sourceMessage.content.match(
              /(<@[0-9]+>|<@&[0-9]+>)/g
            )[0];
            // 暖簾生成元ユーザとコマンド発行元ユーザが同一か判定
            if (
              client.user.id == sourceMessage.author.id &&
              createIssuingUserId.includes(commandIssuingUserId)
            ) {
              deleteNoren(message, sourceMessage);
            }
          });
      };
      judgeNorenDelete(isBotCommand, message);
    } else {
      // noop
      writeLog("messageCreate event detected but not a command.");
    }
  });

  // BOTのtokenが未設定ならエラー
  if (process.env.DISCORD_BOT_TOKEN == undefined) {
    writeLog("please set ENV: DISCORD_BOT_TOKEN");
    process.exit(0);
  }
};

// ======================================================================
// GASにデータをPOSTする関数
// ======================================================================
// 全ての処理をサーバーで完結するよう修正
// ----------------------------------------
// 送信処理
// ----------------------------------------
// const sendGAS = (message) => {
//   writeLog("------------------------------");
//   writeLog("NOREN_CREATE");
//   writeLog("message type:" + message.type);
//   //writeLog(" author:" + message.author);
//   writeLog("reply message:" + message.content.replace(/(<@[0-9]+>|<@&[0-9]+>)/g, ""));

//   // GASへPOSTするJSONデータを設定
//   const jsonData = {
//     author: message.author,
//     content: message.content,
//     channel: message.channel,
//     ismention: message.mentions.has(client.user),
//     userid: message.author.id,
//   };

//   // 非同期処理でPOST
//   const post = async () => {
//     try {
//       await axios({
//         method: "post",
//         url: process.env.GAS_URL,
//         data: jsonData,
//         responseType: "json",
//       }).then((response) => {
//         const msg = response.data;

//         //送信方法を振り分け
//         writeLog("result message type:" + msg.messageType);
//         writeLog("noren message:" + msg.content.replace(/(<@[0-9]+>|<@&[0-9]+>|\r\n)/g, ""));
//         switch (msg.messageType) {
//           case "nothing": // 何もしない
//             break;

//           case "reply": //返信
//             message.reply(msg.content).catch((error) => {
//               writeLog("reply error: " + error.message);
//             });
//             break;

//           case "send": // ただ送る
//             message.channel.send(msg.content).catch((error) => {
//               writeLog("send error: " + error.message);
//             });
//             break;

//           case "delete_send": // 元メッセージの削除と送信
//             message.delete().catch((error) => {
//               writeLog("original message delete error: " + error.message);
//             });
//             writeLog("original message delete success.");
//             message.channel.send(msg.content).catch((error) => {
//               writeLog("send error: " + error.message);
//             });
//             writeLog("noren send success.");

//           default:
//             break;
//         }
//       });
//     } catch (error) {
//       // 何かしらエラーがあったらログ出力
//       message.reply("暖簾作りに失敗しました…ごめんね");
//       writeLog(" **************************************************");
//       writeLog(" Exception");
//       writeLog(" **************************************************");
//       console.log(error);
//     }
//   };
//   post();
// };

// ======================================================================
// 暖簾操作処理
// ======================================================================
const operateNoren = (message) => {
  writeLog("------------------------------");
  writeLog("NOREN_CREATE");
  writeLog("message type:" + message.type);
  writeLog("reply message:" + message.content.replace(/(<@[0-9]+>|<@&[0-9]+>)/g, ""));

  // JSONデータを設定
  const jsonData = {
    author: message.author,
    content: message.content,
    channel: message.channel,
    ismention: message.mentions.has(client.user),
    userid: message.author.id,
  };

  try {   
      // 暖簾作成
      const msg = createNoren(jsonData);
    
      //送信方法を振り分け
      writeLog("result message type:" + msg.messageType);
      writeLog("noren message:" + msg.content.replace(/(<@[0-9]+>|<@&[0-9]+>|\r\n)/g, ""));
      switch (msg.messageType) {
        case "nothing": // 何もしない
          break;
    
        case "reply": //返信
          message.reply(msg.content).catch((error) => {
            writeLog("reply error: " + error.message);
          });
          break;
    
        case "send": // ただ送る
          message.channel.send(msg.content).catch((error) => {
            writeLog("send error: " + error.message);
          });
          break;
    
        case "delete_send": // 元メッセージの削除と送信
          message.delete().catch((error) => {
            writeLog("original message delete error: " + error.message);
          });
          writeLog("original message delete success.");
          message.channel.send(msg.content).catch((error) => {
            writeLog("send error: " + error.message);
          });
          writeLog("noren send success.");
    
        default:
          break;
      }
  } catch (error) {
    // 何かしらエラーがあったらログ出力
    message.reply("暖簾作りに失敗しました…ごめんね");
    writeLog(" **************************************************");
    writeLog(" Exception");
    writeLog(" **************************************************");
    console.log(error);
  }
}

// ----------------------------------------
// 削除処理
// ----------------------------------------
const deleteNoren = (message, sourceMessage) => {
  writeLog(" ------------------------------");
  writeLog(" NOREN_DELETE");
  writeLog(" message type:" + message.type);
  // writeLog(" author:" + message.author);
  writeLog(" delete message:" + sourceMessage.content.replace(/(<@[0-9]+>|<@&[0-9]+>)/g, ""));

  // 元メッセージの削除と削除コマンドメッセージの削除
  message.delete();
  sourceMessage.delete();
};

// ======================================================================
// メイン処理
// ======================================================================
// 実行
connectDiscord();

// GASからのPOSTリクエストを受け取る用
// Botとは別にHTTPサーバを立てる
http
  .createServer((request, response) => {
    response.end("[LOG " + getCurrentTime() + "] Discord bot is active now.");
  })
  .listen(3000);

// 暖簾作成
function createNoren(jsonData) {
  writeLog("createNoren function called.");
  // ============================================================
  // デバッグ用
  // const author = "test";
  // const message = {"content": "# t e s    t"};
  // const isMention = true;
  // ============================================================
  const author = jsonData.userid;
  const message = jsonData.content;
  const isMention = jsonData.ismention;
  let content;
  let messageType;

  // メンションか判定
  if (isMention) {
    // メンションの場合
    let str = message;
    // メンション部分・改行を除外
    str = str.replace(/(<@[0-9]+> *|<@&[0-9]+> *|\r\n|\n|\r)/g, "");
    writeLog("target string: " + str);

    // サイズ指定があるか判定
    let specifyFontSize = str.match(/^(#|##|###) /g);
    if (specifyFontSize !== null) {
      str = str.replace(/^(#|##|###) /g, "");
    }

    // 半角スペースを除外
    str = str.replace(/( )/g, "");

    // 文字数カウント
    let length = 0;
    for (ch of str) {
      length++;
    }

    if (length == 0) {
      content = "リプライの後に続けて暖簾にしたい文字を入力してね。";
      messageType = "reply";

    } else {
      let noren = "￣｜";
      
      for (ch of str) {
        noren += ch + "｜";
      }
      noren = noren.slice(0,-1) + "｜￣";

      // フォントサイズ指定があるなら最後に付与
      if (specifyFontSize !== null) {
        noren = specifyFontSize[0] + noren;
      }

      // メンション付けてメッセージ作成
      content = "<@" + author + ">\r\n" + noren;
      messageType = "delete_send";

      writeLog(content);
    }
    return {
      content: content,
      messageType: messageType,
    };
  }
}

// ログ出力
function writeLog(logMsg) {
  console.log("[LOG " + getCurrentTime() + "] " + logMsg);
}
// 現在時刻取得
function getCurrentTime() {
	var now = new Date(Date.now() + ((new Date().getTimezoneOffset() + (9 * 60)) * 60 * 1000));
	var res = "" + now.getFullYear() + "/" + padZero(now.getMonth() + 1) + 
		"/" + padZero(now.getDate()) + " " + padZero(now.getHours()) + ":" + 
		padZero(now.getMinutes()) + ":" + padZero(now.getSeconds());
	return res;
}
// 0埋め
function padZero(num) {
	var result;
	if (num < 10) {
		result = "0" + num;
	} else {
		result = "" + num;
	}
	return result;
}
