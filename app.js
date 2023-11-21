const express = require("express");
const app = express();
app.use(express.json());
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");
const path = require("path");
const dbPath = path.join(__dirname, "twitterClone.db");
let db;

module.exports = app;
const initializeDbAndServer = async (request, response) => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`Db Error at ${e.message}`);
  }
};
initializeDbAndServer();

const convertIntoCamelCase = (dateObject) => {
  return {
    userId: dateObject.user_id,
    username: dateObject.username,
    tweet: dateObject.tweet,
    dateTime: dateObject.date_time,
  };
};

const authenticateToken = async (request, response, next) => {
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    const jwtToken = authHeader.split(" ")[1];
    if (jwtToken !== undefined) {
      jwt.verify(jwtToken, "hgdhdgdghd", async (error, payload) => {
        if (error) {
          response.status(401);
          response.send("Invalid JWT Token");
          return;
        } else {
          request.username = payload.username;
          next();
        }
      });
    } else {
      response.status(401);
      response.send("Invalid JWT Token");
    }
  } else {
    response.status(401);
    response.send("Invalid JWT Token");
  }
};
//API 1
app.post("/register/", async (request, response) => {
  const { name, username, password, gender } = request.body;
  if (password.length < 6) {
    response.status(400);
    response.send("Password is too short");
  } else {
    const userQuery = `SELECT * FROM user WHERE username='${username}';`;
    const dbUser = await db.get(userQuery);
    if (dbUser === undefined) {
      const hashedPassword = await bcrypt.hash(password, 10);
      const RegisterUserQuery = `INSERT INTO user(name,username,password,gender) VALUES('${name}','${username}','${hashedPassword}','${gender}');`;
      const dbResponse = await db.run(RegisterUserQuery);
      response.send("User created successfully");
    } else {
      response.status(400);
      response.send("User already exists");
    }
  }
});

//API 2
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const userQuery = `SELECT * FROM user WHERE username='${username}';`;
  const dbUser = await db.get(userQuery);
  let jwtToken;
  if (dbUser !== undefined) {
    const ValidUser = await bcrypt.compare(password, dbUser.password);
    if (ValidUser === true) {
      let payload = {
        username: username,
      };
      let jwtToken = jwt.sign(payload, "hgdhdgdghd");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  } else {
    response.status(400);
    response.send("Invalid user");
  }
});

//API 3
app.get("/user/tweets/feed/", authenticateToken, async (request, response) => {
  const { username } = request;
  const userIdQuery = `SELECT user_id FROM user WHERE username='${username}';`;
  const userId = await db.get(userIdQuery);
  const id = userId.user_id;
  const TweetQuery = `SELECT user.username AS userName,tweet.tweet,tweet.date_time AS dateTime FROM (tweet INNER JOIN follower ON tweet.user_id=follower.following_user_id) As T INNER JOIN user ON T.following_user_id=user.user_id  WHERE T.follower_user_id=${id} ORDER BY tweet.tweet_id DESC LIMIT 4 
;`;
  const dbResponse = await db.all(TweetQuery);
  response.send(dbResponse);
});

//API 4
app.get("/user/following/", authenticateToken, async (request, response) => {
  const username = request.username;
  const userIdQuery = `SELECT user_id FROM user WHERE username='${username}';`;
  const userId = await db.get(userIdQuery);
  const id = userId.user_id;
  const userQuery = `SELECT user.name FROM follower INNER JOIN user ON follower.following_user_id=user.user_id WHERE follower.follower_user_id=${id};`;
  const dbResponse = await db.all(userQuery);
  response.send(dbResponse);
});

//API 5
app.get("/user/followers/", authenticateToken, async (request, response) => {
  const username = request.username;
  const userIdQuery = `SELECT user_id FROM user WHERE username='${username}';`;
  const userId = await db.get(userIdQuery);
  const id = userId.user_id;
  const userQuery = `SELECT user.name FROM user INNER JOIN follower ON user.user_id=follower.follower_user_id WHERE follower.following_user_id=${id};`;
  const dbResponse = await db.all(userQuery);
  response.send(dbResponse);
});

//API 6
app.get("/tweets/:tweetId/", authenticateToken, async (request, response) => {
  const username = request.username;
  const { tweetId } = request.params;
  const userIdQuery = `SELECT user_id FROM user WHERE username='${username}';`;
  const userId = await db.get(userIdQuery);
  const id = userId.user_id;
  const checkingTweetUserId = `SELECT * FROM tweet INNER JOIN follower ON tweet.user_id=follower.following_user_id WHERE follower.follower_user_id=${id} AND tweet.tweet_id=${tweetId};`;
  const dbCheck = await db.all(checkingTweetUserId);
  if (dbCheck.length < 1) {
    response.status(401);
    response.send("Invalid Request");
  } else {
    const userQuery = `SELECT tweet.tweet,COUNT(like.like_id)AS likes,COUNT(reply.reply_id)AS replies, tweet.date_time AS dateTime FROM tweet INNER JOIN reply ON tweet.tweet_id=reply.tweet_id INNER JOIN like ON tweet.tweet_id=like.tweet_id WHERE tweet.tweet_id=${tweetId};`;
    const dbResponse = await db.get(userQuery);
    response.send(dbResponse);
  }
});
//API 7
app.get(
  "/tweets/:tweetId/likes/",
  authenticateToken,
  async (request, response) => {
    const username = request.username;
    const { tweetId } = request.params;
    const userIdQuery = `SELECT user_id FROM user WHERE username='${username}';`;
    const userId = await db.get(userIdQuery);
    const id = userId.user_id;
    const checkingTweetUserId = `SELECT * FROM tweet INNER JOIN follower ON tweet.user_id=follower.following_user_id WHERE follower.follower_user_id=${id} AND tweet.tweet_id=${tweetId};`;
    const dbCheck = await db.all(checkingTweetUserId);
    if (dbCheck.length < 1) {
      response.status(401);
      response.send("Invalid Request");
    } else {
      const userQuery = `SELECT user.username AS likes FROM tweet INNER JOIN like ON tweet.tweet_id=like.tweet_id INNER JOIN user ON like.user_id=user.user_id WHERE tweet.tweet_id=${tweetId};`;
      const dbResponse = await db.all(userQuery);
      let new_array = [];
      for (let i of dbResponse) {
        new_array.push(i.likes);
      }
      let new_object = {
        likes: new_array,
      };
      response.send(new_object);
    }
  }
);
//API 8
app.get(
  "/tweets/:tweetId/replies/",
  authenticateToken,
  async (request, response) => {
    const username = request.username;
    const { tweetId } = request.params;
    const userIdQuery = `SELECT user_id FROM user WHERE username='${username}';`;
    const userId = await db.get(userIdQuery);
    const id = userId.user_id;
    const checkingTweetUserId = `SELECT * FROM tweet INNER JOIN follower ON tweet.user_id=follower.following_user_id WHERE follower.follower_user_id=${id} AND tweet.tweet_id=${tweetId};`;
    const dbCheck = await db.all(checkingTweetUserId);
    if (dbCheck.length < 1) {
      response.status(401);
      response.send("Invalid Request");
    } else {
      const userQuery = `SELECT user.name AS name,reply.reply  AS reply FROM tweet INNER JOIN reply ON tweet.tweet_id=reply.tweet_id INNER JOIN user ON user.user_id=reply.user_id WHERE tweet.tweet_id=${tweetId};`;
      const dbResponse = await db.all(userQuery);
      let final_object = {
        replies: dbResponse,
      };
      response.send(final_object);
    }
  }
);

//API 9
app.get("/user/tweets/", authenticateToken, async (request, response) => {
  const username = request.username;
  const { tweetId } = request.params;
  const userIdQuery = `SELECT user_id FROM user WHERE username='${username}';`;
  const userId = await db.get(userIdQuery);
  const id = userId.user_id;
  const tweetQuery = `SELECT tweet.tweet,COUNT(like.like_id)AS likes,COUNT(reply.reply_id)AS replies FROM tweet INNER JOIN like ON tweet.user_id=like.user_id INNER JOIN reply ON reply.user_id=tweet.user_id WHERE tweet.user_id=${id}  ;`;
  const dbResponse = await db.all(tweetQuery);
  response.send(dbResponse);
});

//API 10
app.post("/user/tweets/", authenticateToken, async (request, response) => {
  const { tweet } = request.body;
  const tweetQuery = `INSERT INTO tweet(tweet) VALUES ('${tweet}');`;
  const dbResponse = await db.run(tweetQuery);
  response.send("Created a Tweet");
});

//API 11
app.delete(
  "/tweets/:tweetId/",
  authenticateToken,
  async (request, response) => {
    const username = request.username;
    const { tweetId } = request.params;
    const userIdQuery = `SELECT user_id FROM user WHERE username='${username}';`;
    const userId = await db.get(userIdQuery);
    const id = userId.user_id;
    const tweetQuery = `SELECT * FROM tweet WHERE tweet.user_id=${id} AND tweet.tweet_id=${tweetId};`;
    const dbResponse = await db.all(tweetQuery);
    if (dbResponse.length < 1) {
      response.status(401);
      response.send("Invalid Request");
    } else {
      const finalQuery = `DELETE FROM tweet WHERE tweet_id=${tweetId};`;
      const dbFinal = await db.run(finalQuery);
      response.send("Tweet Removed");
    }
  }
);
