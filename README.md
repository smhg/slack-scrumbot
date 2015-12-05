# slack-scrumbot
> A [Slack](https://www.slack.com/) bot that performs a scrum pre-standup checkin.

## Installation
```bash
$ git clone git@github.com:smhg/slack-scrumbot.git
$ npm install
```

## Usage
#### Start bot
```bash
$ SCRUMBOT_TOKEN=... npm start
```
Invite the bot to a channel with `/invite [botname]`.

#### Start a checkin
Write `@[botname]: checkin @[username] @[username]` in a channel the bot is in.

#### Stop bot
```bash
$ npm stop
```

## Development
```bash
$ DEBUG=slack-scrumbot SCRUMBOT_TOKEN=... npm run watch
```
