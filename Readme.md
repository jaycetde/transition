# Transition

Simple animation library

Most of this library is untested. Use at your own risk and feel free to contribute.

## Installation

	$ component install JayceTDE/transition

## API

```javascript

var Transition = require('transition')
	, el = document.querySelector('#el')
	, transition = new Transition(el)
;

transition
	.to({ left: 500, top: 200, width: 100 }, { duration: 1000, transition: 'ease', callback: function () { console.log('done'); } })
	.then({ top: 500 });

var left = transition.prop('left');

left.to(0).then(500).then(0, { duration: 5000 });

transition.stop();

```

## License

	MIT
