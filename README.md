# slack-scrumbot
> A [Slack](https://www.slack.com/) bot that performs a scrum pre-standup checkin.

## Installation
```bash
$ git clone git@github.com:smhg/slack-scrumbot.git
$ npm install
```

## Usage
Add a bot in Slack's **Integrations** panel. Copy the token.
#### Start bot
```bash
$ SCRUMBOT_TOKEN=your_slack_token npm start
```
Invite the bot to a channel:
```
/invite botname
```

#### Start a checkin
Write a message to the bot:
```
@botname: checkin @username1 @username2 @username3
```

#### Stop bot
```bash
$ npm stop
```

## Development
```bash
$ DEBUG=slack-scrumbot* SCRUMBOT_TOKEN=your_slack_token npm run watch
```
