'use strict';

import {EventEmitter} from 'events';
import pkg from '../package.json';
import Debug from 'debug';

let debug = Debug(`${pkg.name}:checkin`);

export default class Checkin extends EventEmitter {
  constructor(options) {
    super();

    debug(`Start for ${options.users.length} user(s)`);

    this.start = +(new Date());
    this.inviter = options.inviter;
    this.channel = options.channel;
    this.timeout = options.timeout;

    this.responses = options.users.reduce((responses, id) => {
      responses[id] = {};

      return responses;
    }, {});

    this.timeoutInterval = setInterval(() => {
      let now = +(new Date());

      debug(`Running for ${Math.floor((now - this.start) / 60000)} minute(s)`);

      if (now > this.start + options.timeout) {
        this.stop();
      }
    }, 60000);
  }

  stop(quiet) {
    clearInterval(this.timeoutInterval);

    debug(`Stop`);

    if (!quiet) {
      this.emit('end');
    }

    return this;
  }

  addResponse(type, user, response) {
    this.responses[user][type] = response;

    debug(`Got ${type} for ${user}: ${response}`);

    if (Object.keys(this.responses).filter((user) => {return !('blocking' in this.responses[user]);}).length <= 0) {
      // everyone responded
      this.stop();
    }

    return this;
  }

  getWaitingFor() {
    return Object.keys(this.responses).filter((user) => {return !('blocking' in this.responses[user]);});
  }
}
