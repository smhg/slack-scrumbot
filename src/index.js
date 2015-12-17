'use strict';

import Slack from 'slack-client';
import pkg from '../package.json';
import moment from 'moment';
import Debug from 'debug';
import Checkin from './checkin';

let debug = Debug(pkg.name);

const hasBrackets = /^<(.+)>$/,
  slackToken = process.env.SCRUMBOT_TOKEN,
  script = {
    greeting: inviter => `Hi! @${inviter} wanted me to checkin with you.
_Please provide a short (*one-line*) answer to each question._`,
    working: 'What are you working on right now?',
    timing: 'When do you think you will be done with this?',
    blocking: 'Is there anything blocking your progress on this?',
    thankyou: 'Alright. Thank you for this update!'
  },
  slack = new Slack(slackToken, true);

let toMe,
  checkin;

function bracketsToId(str) {
  let [, id] = str.trim().match(hasBrackets);
  return id;
}

slack.on('open', () => {
  debug(`Connected to ${slack.team.name} as ${slack.self.name}`);
  toMe = new RegExp(`^<@${slack.self.id}>`);
});

slack.on('error', (err) => {
  console.error(`Error ${err}`);
});

slack.on('message', (message) => {
  // events
  switch (message.subtype) {
  case 'group_join':
  case 'channel_join':
    if (slack.self.id === message.user) {
      let channel = slack.getChannelGroupOrDMByID(message.channel);
      channel.send(`Hi folks, @${slack.self.name} is here to help run pre-standup checkins.
Say *@${slack.self.name} checkin* to get started.`);
    }

    break;
  case 'message_changed':
    handleMessage(Object.assign({}, message, message.message));
    break;
  case undefined:
    handleMessage(message);
    break;
  default:
    break;
  }
});

function handleMessage (message) {
  let channel = slack.getChannelGroupOrDMByID(message.channel);

  switch ((message.channel || '').substr(0, 1).toUpperCase()) {
  case 'G':
    // group (private channel) message
  case 'C':
    // channel message
    if (toMe.test(message.text)) {
      // commands
      let cmd = message.text.split(' ').slice(1);

      switch (cmd[0]) {
      case 'checkin':
        if (checkin) {
          channel.send(`I'm already doing a checkin. It will be finished in ${moment.duration((checkin.start + checkin.timeout) - new Date()).humanize()} minutes.`);
        } else {
          let inviter = slack.getUserByID(message.user),
            users = cmd.slice(1).reduce((users, id) => {
              id = id.trim();

              if (hasBrackets.test(id)) {
                let prefix = id.substr(1, 1);
                id = id.substr(2, id.length - 3);

                switch (prefix) {
                case '@':
                  users.add(id);
                  break;
                case '!':
                  if (id === 'channel') {
                    channel.members.forEach(user => users.add(user));
                  }
                }
              }

              return users;
            }, new Set());

          users.delete(slack.self.id);

          if (users.size <= 0) {
            channel.send(`Please give me some people to do a checkin with.`);
          } else {
            checkin = new Checkin({
              timeout: pkg.config.waitMinutes * 60 * 1000,
              inviter: message.user,
              channel: message.channel,
              users: Array.from(users)
            });

            checkin.on('end', finale);

            channel.send(`Alright, I'm going to start a checkin.
I'll report back here when everyone replied or in ${moment.duration(checkin.timeout).humanize()}, whatever comes first.`);

            users.forEach((id) => {
              slack.openDM(id, (result) => {
                let dm = slack.getChannelGroupOrDMByID(result.channel.id);

                if (!dm) {
                  console.error(`Could not retrieve DM channel for user '${result.channel.id}'.`);
                } else {
                  dm.send(script.greeting(inviter.name));
                  dm.send(`${script.working}`);
                }
              });
            });
          }
        }

        break;
      case 'stop':
        if (checkin) {
          checkin.stop(true);
          checkin = null;

          channel.send(`Alright. Those answers are going to /dev/null.`);
        } else {
          channel.send(`I can't stop doing nothing.`);
        }

        break;
      case 'status':
        if (checkin) {
          let waitingUsers = checkin.getWaitingFor();

          channel.send(`I'm doing a checkin.
${waitingUsers.reduce((result, id, idx, all) => {
  let user = slack.getUserByID(id);

  if (user) {
    if (result) {
      if (idx === all.length - 1) {
        result = `${result} and @${user.name}`;
      } else {
        result = `${result}, @${user.name}`;
      }
    } else {
      result = `@${user.name}`;
    }
  }

  return result;
}, '')} still {$waitingUsers.length === 1 ? 'has' : 'have'} to answer.
I will wait ${moment.duration((checkin.start + checkin.timeout) - new Date()).asMinutes()} more minutes.`);
        } else {
          channel.send(`I'm not doing anything.`);
        }

        break;
      case 'help':
        channel.send(`There is only a _limited_ set of problems I can help you with.
That would currently be \`checkin\`, \`stop\`, \`status\` and \`version\`.`);

        break;
      case 'version':
        channel.send(`My internals are labeled ${pkg.version}.`);

        break;
      default:
        channel.send(`I learnt English from a book.`);

        break;
      }
    }

    break;
  case 'D':
    // direct message
    if (checkin && (message.user in checkin.responses)) {
      let response = checkin.responses[message.user];

      if (!('working' in response)) {
        checkin.addResponse('working', message.user, message.text);
        channel.send(`${script.timing}`);
      } else if (!('timing' in response)) {
        checkin.addResponse('timing', message.user, message.text);
        channel.send(`${script.blocking}`);
      } else if (!('blocking' in response)) {
        checkin.addResponse('blocking', message.user, message.text);
        channel.send(script.thankyou);
      }
    }

    break;
  }
}

function finale () {
  let channel = slack.getChannelGroupOrDMByID(checkin.channel);

  let listResult = (title, responses) => `>>>*${title}*\n${responses.join('\n')}`,
    inviter = slack.getUserByID(checkin.inviter);

  channel.send(`@${inviter.name}, I'm done with the checkin:`);

  let result = Object.keys(checkin.responses).reduce((result, id) => {
    let user = slack.getUserByID(id),
      response = checkin.responses[id];

    if (response.working) {
      result.working.push(`@${user.name}: ${response.working}`);
    }

    if (response.timing) {
      result.timing.push(`@${user.name}: ${response.timing}`);
    }

    if (response.blocking) {
      result.blocking.push(`@${user.name}: ${response.blocking}`);
    }

    return result;
  }, {
    working: [],
    timing: [],
    blocking: []
  });

  channel.send(listResult(script.working, result.working));
  channel.send(listResult(script.timing, result.timing));
  channel.send(listResult(script.blocking, result.blocking));

  checkin = null;
}

slack.login();
