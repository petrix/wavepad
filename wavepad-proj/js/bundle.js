(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
// import Wavepad from './wavepad';
// import registerServiceWorker from './sw-bootstrap';


var Wavepad = require('./wavepad');
var registerServiceWorker = require('./sw-bootstrap');


window.addEventListener('DOMContentLoaded', () => {

    var app = new Wavepad('wave-pd1');
    app.init();

    registerServiceWorker();
});

},{"./sw-bootstrap":2,"./wavepad":3}],2:[function(require,module,exports){
function registerServiceWorker() {

    if (!navigator.serviceWorker) {
        return;
    }

    function trackInstalling(worker) {
        console.log('Service Worker: installing...');
        worker.addEventListener('statechange', () => {
            console.log('Service Worker: ', worker.state);
        });
    }

    navigator.serviceWorker.register('sw.js', {
        scope: './'
    }).then(reg => {
        console.log('Service Worker: registered');

        if (!navigator.serviceWorker.controller) {
            return;
        }

        if (reg.waiting) {
            console.log('Service Worker: installed');
            return;
        }

        if (reg.installing) {
            trackInstalling(reg.installing);
            return;
        }

        reg.addEventListener('updatefound', () => {
            trackInstalling(reg.installing);
        });

    }).catch(err => {
        console.log('Service Worker: registration failed ', err);
    });
}

// export default registerServiceWorker;
module.exports = registerServiceWorker;

},{}],3:[function(require,module,exports){
class Wavepad {

    constructor(id, options) {
        // default options
        this.options = {
            waveform: 'square',
            filter: 'lowpass',
            delay: 0.005,
            feedback: 0.1,
            barColor: '#6d1c25'
        };

        // set configurable options
        if (typeof options === 'object') {
            for (let i in options) {
                if (options.hasOwnProperty(i)) {
                    this.options[i] = options[i];
                }
            }
        }

        // Web Audio Node references
        this.source = null;
        this.nodes = {};
        this.myAudioContext = null;
        this.myAudioAnalyser = null;

        // normalize and create a new AudioContext if supported
        window.AudioContext = window.AudioContext || window.webkitAudioContext;

        if ('AudioContext' in window) {
            this.myAudioContext = new window.AudioContext();
        } else {
            throw new Error('wavepad.js: browser does not support Web Audio API');
        }

        if (typeof id !== 'string' && typeof id !== 'object') {
            throw new Error('wavepad.js: first argument must be a valid DOM identifier');
        }

        // UI DOM references
        this.synth = typeof id === 'object' ? id : document.getElementById(id);
        this.surface = this.synth.querySelector('.surface');
        this.finger = this.synth.querySelector('.finger');
        this.waveform = this.synth.querySelector('#waveform');
        this.filter = this.synth.querySelector('#filter-type');
        this.powerToggle = this.synth.querySelector('#power');
        this.delayTimeInput = this.synth.querySelector('#delay');
        this.feedbackGainInput = this.synth.querySelector('#feedback');
        this.delayTimeOutput = this.synth.querySelector('#delay-output');
        this.feedbackGainOutput = this.synth.querySelector('#feedback-output');

        // Canvas graph for audio frequency analyzer
        this.canvas = this.synth.querySelector('canvas');
        this.ctx = this.canvas.getContext('2d');

        this.hasTouch = false;
        this.isSmallViewport = false;
        this.isPlaying = false;
        this.audioElement = document.querySelector('audio');
        this.source = this.myAudioContext.createMediaElementSource(this.audioElement);
    }

    init() {
        // bind resize handler for canvas & touch references
        this.handleResize();

        // store references to bound events
        // so we can unbind when needed
        this.startHandler = this.start.bind(this);
        this.moveHandler = this.move.bind(this);
        this.stopHandler = this.stop.bind(this);

        // set default values that we're supplied
        this.delayTimeInput.value = this.options.delay;
        this.feedbackGainInput.value = this.options.feedback;
        this.waveform.value = this.options.waveform;
        this.filter.value = this.options.filter;
        this.updateOutputs();

        // bind UI control events
        this.powerToggle.addEventListener('click', this.togglePower.bind(this));
        this.waveform.addEventListener('change', this.setWaveform.bind(this));
        this.filter.addEventListener('change', this.filterChange.bind(this));
        this.delayTimeInput.addEventListener('input', this.delayChange.bind(this));
        this.feedbackGainInput.addEventListener('input', this.feedbackChange.bind(this));

        // create Web Audio nodes
        this.nodes.oscVolume = this.myAudioContext.createGain();
        this.nodes.filter = this.myAudioContext.createBiquadFilter();
        this.nodes.volume = this.myAudioContext.createGain();
        this.nodes.delay = this.myAudioContext.createDelay();
        this.nodes.feedbackGain = this.myAudioContext.createGain();
        this.nodes.compressor = this.myAudioContext.createDynamicsCompressor();

        // create frequency analyser node
        this.myAudioAnalyser = this.myAudioContext.createAnalyser();
        this.myAudioAnalyser.smoothingTimeConstant = 0.85;

        // start fAF for frequency analyser
        this.animateSpectrum();

        // prevent default scrolling when touchmove fires on surface
        this.surface.addEventListener('touchmove', e => {
            e.preventDefault();
        });
    }

    handleResize() {
        let breakPoint = window.matchMedia('(max-width: 768px)');
        // set default canvas size
        this.isSmallViewport = breakPoint.matches ? true : false;
        this.setCanvasSize();

        // listen for resize events
        breakPoint.addListener(mql => {
            this.isSmallViewport = mql.matches ? true : false;
            this.setCanvasSize();
        });
    }

    routeSounds() {

        console.log('routeSounds');

        // this.audioElement = document.querySelector('audio');
        // this.source = this.myAudioContext.createMediaElementSource(this.audioElement);

        // this.source = this.myAudioContext.createOscillator();
        



        this.setWaveform(this.waveform);
        this.filterChange(this.filter);
        this.nodes.feedbackGain.gain.value = this.options.feedback;
        this.nodes.delay.delayTime.value = this.options.delay;
        this.nodes.volume.gain.value = 0.3;
        this.nodes.oscVolume.gain.value = 0;

        this.source.connect(this.nodes.oscVolume);
        this.nodes.oscVolume.connect(this.nodes.filter);
        this.nodes.filter.connect(this.nodes.compressor);
        this.nodes.filter.connect(this.nodes.delay);
        this.nodes.delay.connect(this.nodes.feedbackGain);
        this.nodes.delay.connect(this.nodes.compressor);
        this.nodes.feedbackGain.connect(this.nodes.delay);
        this.nodes.compressor.connect(this.nodes.volume);
        this.nodes.volume.connect(this.myAudioAnalyser);
        this.myAudioAnalyser.connect(this.myAudioContext.destination);
    }

    startOsc() {
        if (this.myAudioContext.state === 'suspended') {
            // console.log(streamUrl);
            this.myAudioContext.resume();
          }
        // this.source.start(0);
        this.audioElement.load();
        this.audioElement.play();
        this.isPlaying = true;
    }

    stopOsc() {
        // this.source.stop(0);
        this.audioElement.pause();

        this.isPlaying = false;
    }

    bindSurfaceEvents() {
        this.surface.addEventListener('mousedown', this.startHandler);
        this.surface.addEventListener('touchstart', this.startHandler);
    }

    unbindSurfaceEvents() {
        this.surface.removeEventListener('mousedown', this.startHandler);
        this.surface.removeEventListener('touchstart', this.startHandler);
    }

    togglePower() {
        if (this.isPlaying) {
            this.stopOsc();
            this.myAudioAnalyser.disconnect();
            this.unbindSurfaceEvents();
        } else {
            this.routeSounds();
            this.startOsc();
            this.bindSurfaceEvents();
        }

        this.synth.classList.toggle('off');
    }

    start(e) {
        let x = e.type === 'touchstart' ? e.touches[0].pageX : e.pageX;
        let y = e.type === 'touchstart' ? e.touches[0].pageY : e.pageY;
        let multiplier = this.isSmallViewport ? 3 : 1;

        if (e.type === 'touchstart') {
            this.hasTouch = true;
        } else if (e.type === 'mousedown' && this.hasTouch) {
            return;
        }

        if (!this.isPlaying) {
            this.routeSounds();
            this.startOsc();
        }

        x = x - this.surface.offsetLeft;
        y = y - this.surface.offsetTop;

        this.nodes.oscVolume.gain.value = 1;
        this.nodes.delay.delayTime.value = this.setXValue(x);
        // this.source.frequency.value = x * multiplier;
        this.nodes.filter.frequency.value = this.setFilterFrequency(y);
        this.updateOutputs();
        this.finger.style.webkitTransform = this.finger.style.transform = `translate3d(${x}px, ${y}px, 0)`;
        this.finger.classList.add('active');

        this.surface.addEventListener('touchmove', this.moveHandler);
        this.surface.addEventListener('touchend', this.stopHandler);
        this.surface.addEventListener('touchcancel', this.stopHandler);
        this.surface.addEventListener('mousemove', this.moveHandler);
        this.surface.addEventListener('mouseup', this.stopHandler);
    }

    move(e) {
        let x = e.type === 'touchmove' ? e.touches[0].pageX : e.pageX;
        let y = e.type === 'touchmove' ? e.touches[0].pageY : e.pageY;

        if (e.type === 'mousemove' && this.hasTouch) {
            return;
        }

        if (this.isPlaying) {
            let multiplier = this.isSmallViewport ? 3 : 1;
            x = x - this.surface.offsetLeft;
            y = y - this.surface.offsetTop;
            // this.nodes.feedbackGain.gain.value = this.setXValue(x);
            this.nodes.delay.delayTime.value = this.setXValue(x);
            // this.source.frequency.value = x * multiplier;
            // console.log(x,multiplier);
            this.nodes.filter.frequency.value = this.setFilterFrequency(y);
            this.updateOutputs();
        }

        this.finger.style.webkitTransform = this.finger.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    }
    setXValue(x){
        let multiplier = Math.pow(2, 4 * (1.0 - ((2 / this.canvas.width/2) * (this.canvas.width - x))-1.0));
        console.log(x,x*multiplier,multiplier);
        return multiplier;
        
    }
    stop(e) {
        let x = e.type === 'touchend' ? e.changedTouches[0].pageX : e.pageX;
        let y = e.type === 'touchend' ? e.changedTouches[0].pageY : e.pageY;

        if (this.isPlaying) {
            let multiplier = this.isSmallViewport ? 3 : 1;
            x = x - this.surface.offsetLeft;
            y = y - this.surface.offsetTop;
            this.nodes.delay.delayTime.value = this.setXValue(x);
            // this.source.frequency.value = x * multiplier;
            this.nodes.filter.frequency.value = this.setFilterFrequency(y);
            this.nodes.oscVolume.gain.value = 0;
            this.updateOutputs();
        }

        this.finger.classList.remove('active');

        this.surface.removeEventListener('mousemove', this.moveHandler);
        this.surface.removeEventListener('mouseup', this.stopHandler);
        this.surface.removeEventListener('touchmove', this.moveHandler);
        this.surface.removeEventListener('touchend', this.stopHandler);
        this.surface.removeEventListener('touchcancel', this.stopHandler);
    }

    updateOutputs() {
        this.delayTimeOutput.value = Math.round(this.delayTimeInput.value * 1000) + ' ms';
        this.feedbackGainOutput.value = Math.round(this.feedbackGainInput.value * 10);
    }

    setWaveform(option) {
        // this.source.type = option.value || option.target.value;
    }

    delayChange(e) {
        this.options.delay = e.target.value;
        if (this.isPlaying) {
            this.stopOsc();
            this.nodes.delay.delayTime.value = this.options.delay;
        }
        this.updateOutputs();
    }

    feedbackChange(e) {
        this.options.feedback = e.target.value;
        if (this.isPlaying) {
            this.stopOsc();
            this.nodes.feedbackGain.gain.value = this.options.feedback;
        }
        this.updateOutputs();
    }

    /**
     * Set filter frequency based on (y) axis value
     */
    setFilterFrequency(y) {
        // min 40Hz
        let min = 40;
        // max half of the sampling rate
        let max = this.myAudioContext.sampleRate / 2;
        // Logarithm (base 2) to compute how many octaves fall in the range.
        let numberOfOctaves = Math.log(max / min) / Math.LN2;
        // Compute a multiplier from 0 to 1 based on an exponential scale.
        // let multiplier = Math.pow(2, numberOfOctaves * (((2 / this.surface.clientHeight) * (this.surface.clientHeight - y)) - 1.0));
        let multiplier = Math.pow(2, numberOfOctaves * (((2 / this.canvas.height/2) * (this.canvas.height - y)) - 1.0));
        // console.log(y,max*multiplier,multiplier);
        // Get back to the frequency value between min and max.
        return max * multiplier;
    }

    filterChange(option) {
        this.nodes.filter.type = option.value || option.target.value;
    }

    animateSpectrum() {
        // Limit canvas redraw to 40 fps
        setTimeout(this.onTick.bind(this), 1000 / 40);
    }

    onTick() {
        this.drawSpectrum();
        requestAnimationFrame(this.animateSpectrum.bind(this));
    }

    setCanvasSize() {
        let canvasSize = this.isSmallViewport ? 256 : 768;
        this.canvas.width = canvasSize - 10
        this.canvas.height = 512 - 10;
        // set canvas graph color
        this.ctx.fillStyle = this.options.barColor;
    }

    /**
     * Draw the canvas frequency data graph
     */
    drawSpectrum() {
        let canvasSize = this.isSmallViewport ? 256 : 768;
        let barWidth = this.isSmallViewport ? 10 : 20;
        let barCount = Math.round(canvasSize / barWidth);
        let freqByteData = new Uint8Array(this.myAudioAnalyser.frequencyBinCount);

        this.myAudioAnalyser.getByteFrequencyData(freqByteData);
        this.ctx.clearRect(0, 0, canvasSize, canvasSize);

        for (let i = 0; i < barCount; i += 1) {
            let magnitude = freqByteData[i];
            let multiplier = this.isSmallViewport ? 1 : 3;
            // some values need adjusting to fit on the canvas
            this.ctx.fillRect(barWidth * i, canvasSize, barWidth - 1, -magnitude * multiplier);
        }
    }
}
module.exports = Wavepad;

// export default Wavepad;

},{}]},{},[1]);
