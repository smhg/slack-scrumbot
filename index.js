'use strict';

import Slack from 'slack-client';
import pkg from './package.json';
import moment from 'moment';
import Debug from 'debug';

let debug = Debug(pkg.name);

const bracketsUser = /^<@(.+)>$/,
  slackToken = process.env.SCRUMBOT_TOKEN;

let slack = new Slack(slackToken, true);

let script = {
  greeting: inviter => `Hi! @${inviter} wanted me to checkin with you.\n_Please provide a short (*one-line*) answer to each question._`,
  working: 'What are you working on right now?',
  timing: 'When do you think you will be done with this?',
  blocking: 'Is there anything blocking your progress on this?',
  thankyou: 'Alright. Thank you for this update!'
};

function isUser(brackets) {
  return bracketsUser.test(brackets.trim());
}

function bracketsToId(brackets) {
  let [, id] = brackets.trim().match(bracketsUser);
  return id;
}

let check = {},
  checkInterval;

slack.on('open', () => {
  console.log(`Connected to ${slack.team.name} as ${slack.self.name}`);
});

slack.on('error', (err) => {
  console.log(`Error ${err}`);
});

slack.on('message', (message) => {
  switch (message.subtype) {
  case 'channel_join':
    if (slack.self.id === message.user) {
      let channel = slack.getChannelGroupOrDMByID(message.channel);
      channel.send(`Hi folks, @${slack.self.name} is here to help run pre-standup checkins.\nSay *@${slack.self.name} checkin* to get started.`);
    }

    break;
  case undefined:
    let toMe = new RegExp(`^<@${slack.self.id}>`);

    if (toMe.test(message.text)) {
      // commands
      let cmd = message.text.split(' ').slice(1),
        channel = slack.getChannelGroupOrDMByID(message.channel);

      switch (cmd[0]) {
      case 'checkin':

        if (check.ts && check.ts > 0) {
          channel.send(`I'm already doing a checkin. In ${moment.duration((check.ts + pkg.config.waitMinutes * 60 * 1000) - new Date()).humanize()} that will be finished.`);
        } else {
          let inviter = slack.getUserByID(message.user),
            users = cmd.slice(1).filter(isUser).map(bracketsToId);

          check.ts = +(new Date());
          check.inviter = message.user;
          check.channel = message.channel;
          check.users = users;
          check.responses = {};

          if (users.length > 0) {
            channel.send(`Alright, I'm going to start a checkin.\nI'll report back here when everyone replied or in ${moment.duration(pkg.config.waitMinutes * 60 * 1000).humanize()}, whatever comes first.`);

            users.forEach((id) => {
              slack.openDM(id, (result) => {
                let dm = slack.getChannelGroupOrDMByID(result.channel.id);

                dm.send(script.greeting(inviter.name));
                dm.send(`${script.working}`);
              });
            });

            checkInterval = setInterval(() => {
              if (+(new Date()) > check.ts + (pkg.config.waitMinutes * 60 * 1000)) {
                finale();
              }
            }, 1000);
          }
        }

        break;
      case 'stop':
        stopCheckin();

        break;
      case 'help':
        channel.send(`There is only a _limited_ set of problems I can help you with.`);

        break;
      case 'version':
        channel.send(`My internals are labeled ${pkg.version}.`);

        break;
      default:
        channel.send(`I learned English from a book.`);

        break;
      }
    } else if (message.channel.substr(0, 1) === 'D') {
      let dm = slack.getChannelGroupOrDMByID(message.channel);

      check.responses[message.user] = check.responses[message.user] || {};

      if (!check.responses[message.user].working) {
        check.responses[message.user].working = message.text;

        dm.send(`${script.timing}`);
      } else if (!check.responses[message.user].timing) {
        check.responses[message.user].timing = message.text;

        dm.send(`${script.blocking}`);
      } else if (!check.responses[message.user].blocking) {
        check.responses[message.user].blocking = message.text;

        dm.send(script.thankyou);

        if (check.users.filter(user => !check.responses[user]).length <= 0) {
          finale();
        }
      }
    }

    break;
  default:
    break;
  }
});

function stopCheckin() {
  if (check.ts && check.ts > 0) {
    clearInterval(checkInterval);
    check = {};
  }
}

function finale () {
  let channel = slack.getChannelGroupOrDMByID(check.channel);

  let listResult = (title, responses) => `>>>*${title}*\n${responses.join('\n')}`,
    inviter = slack.getUserByID(check.inviter);

  channel.send(`@${inviter.name}, I'm done with the checkin:`);

  let res = {
    working: [],
    timing: [],
    blocking: []
  };

  check.users.forEach((id) => {
    let user = slack.getUserByID(id);

    if (check.responses[id].working) {
      res.working.push(`@${user.name}: ${check.responses[id].working}`);
    }

    if (check.responses[id].timing) {
      res.timing.push(`@${user.name}: ${check.responses[id].timing}`);
    }

    if (check.responses[id].blocking) {
      res.blocking.push(`@${user.name}: ${check.responses[id].blocking}`);
    }
  });

  channel.send(listResult(script.working, res.working));
  channel.send(listResult(script.timing, res.timing));
  channel.send(listResult(script.blocking, res.blocking));

  stopCheckin();
}

slack.logger.debug = debug;
slack.login();
