'use strict';

var each = require('each')
  , inherit = require('inherit')
  , Emitter = require('emitter')
  , once = require('once')
  , capitalize = require('capitalize')
  , defaults = require('deeperDefaults')
  , raf = require('raf')
  , bezier = require('cubic-bezier')
  , now
  , registered = []
;

function cssTransform(el, prop, duration, timing) {
    stylar()
}

now = function () {
    return window.mozAnimationStartTime || (window.performance && window.performance.now && window.performance.now()) || Date.now();
};

var defaultValues = {
  duration: 300,
  transition: 'ease',
  unit: 'px'
};

function tick(time) {

    var i = 0
      , l = registered.length
    ;

    if (l === 0) {
        tick._running = false;
        return;
    }

    while (i < l) {
        registered[i].tick(time);
        i += 1;
    }

    raf(tick);

}

tick._running = false;

tick.register = function (obj) {
    registered.push(obj);

    if (!tick._running) {
        tick._running = true;
        raf(tick);
    }
};

tick.unregister = function (obj) {
    var i, len = registered.length;
    for (i = 0; i < len; i += 1) {
        if (registered[i] === obj) {
            return registered.splice(i, 1);
        }
    }
};

var Prop = function (prop, parent) {

    this.prop = prop;
    this.parent = parent;

    return this;

};

Prop.prototype.set = function (val) {
    this.parent.set(this.prop, val);
    return this;
};

Prop.prototype.get = function (val) {
    return this.parent.get(this.prop);
};

Prop.prototype.to = function (val, options) {
    var setter = {};
    setter[this.prop] = val;
    this.parent.to(setter, options);
    return this;
};

Prop.prototype.then = function (val, options) {
    var setter = {};
    setter[this.prop] = val;
    this.parent.then(setter, options);
    return this;
};

var Transition = function (el) {

    var self = this;

    self.el = el;
    self.running = false;
    self.animations = {};
    self.queue = [];

    self.boundTick = tick.bind(this);

    self.on('done', self.runNextQueue);

};

inherit(Transition, Emitter);

Transition.prototype.prop = function (prop) {

    return new Prop(prop, this);

};

Transition.prototype.to = function (props, options) {

    var self = this
    , animations = self.animations
    , startTime = now()
    ;

    if (!props) {
        throw 'no properties were set';
    }

    options = options || {};

    options = defaults(options, defaultValues);

    if (options.callback) {
        options.callback = once(options.callback);
    }

    each(props, function (prop, val) {

        var property = Transition.properties[prop]
        , startVal
        ;

        if (!property) {
            throw "no handler found for this property";
        }

        startVal = property.get(self.el);

        if (typeof(options.duration) === 'function') {
            options.duration = options.duration(startVal, val);
        }

        animations[prop] = {
            property: prop,
            startValue: startVal,
            endValue: val,
            startTime: startTime,
            endTime: startTime + options.duration,
            duration: options.duration,
            transition: options.transition,
            callback: options.callback
        };

    });

    if (!self.running) {
        self.run();
    }

    return this;

};

Transition.prototype.get = function (prop) {

    var property = Transition.properties[prop];

    if (!property) {
        throw "no handler found for this property";
    }

    return property.get(this.el);

};

Transition.prototype.set = function (prop, val) {

    var property = Transition.properties[prop];

    if (!property) {
        throw "no handler found for this property";
    }

    property.set(this.el, val);

    return this;

};

Transition.prototype.run = function () {

    this.running = true;

    tick.register(this);

    this.emit('run');

};

Transition.prototype.done = function () {

    this.running = false;

    this.emit('done');

};

Transition.prototype.then = function () {

    if (this.running) {
        this.queue.push(arguments);
        return this;
    }

    this.to.apply(this, arguments);

    return this;

};

Transition.prototype.runNextQueue = function () {

    if (this.queue.length) {
        this.to.apply(this, this.queue.shift());
    }

};

Transition.prototype.stop = function (prop) {

    var self = this;

    if (prop) {
        delete self.animations[prop];
        return;
    }

    each(self.animations, function (prop) {
        delete self.animations[prop];
    });

    return this;

};

Transition.prototype.tick = function (time) {

    var self = this
      , prop
      , animation
      , property
      , isAnimating = false
    ;

    for (prop in self.animations) {
        if (self.animations.hasOwnProperty(prop)) {

            animation = self.animations[prop];
            property = Transition.properties[prop];

            if (!property) {
                delete self.animations[prop];
                continue;
            }

            if (time < animation.endTime) {

                var percent = Transition.transitions[animation.transition]((time - animation.startTime) / animation.duration)
                  , val = property.calc(percent, animation.startValue, animation.endValue)
                ;

                property.set(self.el, val);

                isAnimating = true;

            } else {

                if (animation.callback) {
                    animation.callback();
                }

                property.set(self.el, animation.endValue);

                delete self.animations[prop];

            }

        }
    }

    if (!isAnimating) {
        tick.unregister(self);
        self.done();
    }

};

var epsilon = 0.0005;

Transition.transitions = {
    'ease': bezier(0.25, 0.1, 0.25, 1, epsilon),
    'linear': function (per) {
        //return Math.round(start + ((end - start) * per));
        return per;
    },
    'ease-in': bezier(0.42, 0, 1, 1, epsilon),
    'ease-out': bezier(0, 0, 0.58, 1, epsilon),
    'ease-in-out': bezier(0.42, 0, 0.58, 1, epsilon)
};

Transition.properties = {};

function computedStyle(el) {
    return getComputedStyle ? getComputedStyle(el) : el.currentStyle ? el.currentStyle : el.style;
}

function getComputed(el, prop) {
    return computedStyle(el).getPropertyValue(prop);
}

function standardCalc(per, start, end) {
    return start + ((end - start) * per);
}

each('bottom left marginBottom marginLeft marginRight marginTop paddingBottom paddingLeft paddingRight paddingTop right top'.split(' '), function (prop) {

    var unit = 'px';

    Transition.properties[prop] = {
        toParse: function (el, val) {
            // convert val to pixels
        },
        set: function (el, val) {
            el.style[prop] = val + unit;
        },
        get: function (el) {
            var val = parseFloat(getComputed(el, prop), 10);
            return isNaN(val) ? 0 : val;
        },
        calc: standardCalc
    };

});

each('height width'.split(' '), function (prop) {

    var capProp = capitalize(prop)
      , unit = 'px'
    ;

    Transition.properties[prop] = {
        toParse: function (el, val) {

        },
        set: function (el, val) {
            el.style[prop] = val + unit;
        },
        get: function (el) {
            return el['offset' + capProp];
        },
        calc: standardCalc
    };
});

Transition.properties['opacity'] = {
    set: function (el, val) {
        el.style['opacity'] = val;
    },
    get: function (el) {
        var val = parseFloat(getComputed(el, 'opacity'), 10);
        return isNaN(val) ? 1 : val;
    },
    calc: standardCalc
};

module.exports = Transition;
