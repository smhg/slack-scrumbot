# slack-scrumbot
> A [Slack](https://www.slack.com/) bot that performs a scrum pre-standup checkin.

## Installation
```bash
$ npm install slack-scrumbot
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
Write a message to the bot listing the users to do a checkin with:
```
@botname: checkin @username1 @username2 @username3
```
Or write a message to the channel to do a checkin with everyone:
```
@botname: checkin @channel
```

#### Stop bot
```bash
$ npm stop
```

## Development
```bash
$ DEBUG=slack-scrumbot* SLACK_LOG_LEVEL=debug SCRUMBOT_TOKEN=your_slack_token npm run watch
```
