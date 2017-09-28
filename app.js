#!/usr/bin/env node

//
// # Saitek Pro Flight Switch Panel HID Controller
// MIT Licensed
// Copyright 2014- Nick Baugh <niftylettuce@gmail.com>
//

var _ = require('underscore')
var HID = require('node-hid')
var http = require('http')
var chalk = require('chalk')

var devices = HID.devices()

var productName = 'Saitek Pro Flight Switch Panel'

var deviceFound = _.findWhere(devices, {
  product: productName
})

if (_.isUndefined(deviceFound))
  return console.log(chalk.red('%s was not found as a connected HID device'), productName)

function change(name, path, value) {
  http.get('http://localhost:5000' + path + '?value=' + value + '&submit=update', function(res) {
    console.log(chalk.green('updated flightgear'))
  }).on('error', function(err) {
    console.log(chalk.red('Could not connect to FlightGear httpd port 5000: ' + err.message))
  })
  if (value)
    console.log(chalk.green(name))
  else
    console.log(chalk.red(name))
}


function getBitIndexFlipped(a, b) {
  var fieldA = 0, fieldB = 0
  for (var i=0; i<a.length; i++) fieldA = (fieldA << 8) | a[i]
  for (var z=0; z<b.length; z++) fieldB = (fieldB << 8) | b[z]
  var diff = fieldA ^ fieldB
  var retval = []
  var count = 0
  while (diff > 0) {
    if (diff & 0x01 > 0) retval[retval.length] = count
    diff = diff >> 1
    count++
  }
  return retval
}

var device = new HID.HID(deviceFound.path)

var currentBits = [ 0x0, 0x0, 0x0 ]

var MAGNETO_BOTH = 0
var MAGNETO_START = 1
var GEAR_UP = 2
var GEAR_DOWN = 3
var MAGNETO_OFF = 13
var MAGNETO_RIGHT = 14
var MAGNETO_LEFT = 15
var MASTER_BATTERY = 16
var MASTER_ALT = 17
var AVIONICS_MASTER = 18
var FUEL_PUMP = 19
var DE_ICE = 20
var PITOT_HEAT = 21
var COWL = 22
var PANEL_LIGHT = 23
var BEACON_LIGHT = 8
var NAV_LIGHT = 9
var STROBE_LIGHT = 10
var TAXI_LIGHT = 11
var LANDING_LIGHT = 12

var controls = []

function on(controlIndex) {
  return _.contains(controls, controlIndex)
}

device.on('data', function(data) {

  controls = getBitIndexFlipped([], data)

  console.log(chalk.cyan('switches:'), controls)

  // MAGNETO_OFF = 0
  // MAGNETO_RIGHT = 1
  // MAGNETO_LEFT = 2
  // MAGNETO_BOTH = 3
  // <http://localhost:5000/controls/engines/engine/magnetos?value=X&submit=update>
  var magneto = 0
  if (on(MAGNETO_START)) {
    change('magneto', '/controls/engines/engine/magnetos', 3)
    change('ignition', '/controls/engines/engine/ignition', 2)
  } else {
    if (on(MAGNETO_OFF))
      magneto = 0
    else if (on(MAGNETO_RIGHT))
      magneto = 1
    else if (on(MAGNETO_LEFT))
      magneto = 2
    else if (on(MAGNETO_BOTH))
      magneto = 3
    change('magneto', '/controls/engines/engine/magnetos', magneto)
    change('ignition', '/controls/engines/engine/ignition', magneto > 0 ? 2 : 0)
  }

  // MAGNETO_START
  change('magneto start', '/controls/switches/starter', on(MAGNETO_START))
  change('starter', '/controls/engines/engine/starter', on(MAGNETO_START))

  // GEAR UP
  // http://localhost:5000/controls/gear/gear-down?value=false
  change('gear', '/controls/gear/gear-down', !on(GEAR_UP))

  // GEAR DOWN
  // http://localhost:5000/controls/gear/gear-down?value=true
  change('gear', '/controls/gear/gear-down', on(GEAR_DOWN))

  // LANDING GEAR LIGHTS
  if (on(GEAR_DOWN))
    //device.write([0x0, 0x01 | 0x02 | 0x04 ])
    device.sendFeatureReport([0x00, 0x01 | 0x02 | 0x04 ])
  else if (on(GEAR_UP))
    //device.write([0x0, 0x08 | 0x10 | 0x20 ])
    device.sendFeatureReport([0x00, 0x08 | 0x10 |0x20 ])

  // MASTER_BATTERY
  change('master battery', '/controlers/engines/engine/master-bat', on(MASTER_BATTERY))
  change('battery switch', '/controls/electric/battery-switch', on(MASTER_BATTERY))
  change('battery switch[1]', '/controls/electric/battery-switch[1]', on(MASTER_BATTERY))

  // MASTER_ALT
  change('master alt', '/controlers/engines/engine/master-alt', on(MASTER_ALT))
  change('generator', '/controls/electric/engine/generator', on(MASTER_ALT))
  change('APU generator', '/controls/electric/APU-generator', on(MASTER_ALT))
  change('generator 2', '/controls/electric/engine[1]/generator', on(MASTER_ALT))
  change('generator 2', '/controls/electric/engine[2]/generator', on(MASTER_ALT))

  // AVIONICS_MASTER
  change('avionics switch', '/controls/electric/avionics-switch', on(AVIONICS_MASTER))

  // FUEL_PUMP
  change('fuel pump', '/controlers/engines/engine/fuel-pump', on(FUEL_PUMP))
  change('fuel pump', '/controls/engines/engine/fuel-pump', on(FUEL_PUMP))

  // DE_ICE
  change('window heat', '/controls/anti-ice/window-heat', on(DE_ICE))
  change('wing heat', '/controls/anti-ice/wing-heat', on(DE_ICE))
  change('carb heat', '/controls/anti-ice/engine/carb-heat', on(DE_ICE))
  change('inlet heat', '/controls/anti-ice/engine/inlet-heat', on(DE_ICE))

  // PITOT_HEAT
  change('pitot heat', '/controls/anti-ice/pitot-heat', on(PITOT_HEAT))

  // COWL
  change('cowl', '/controls/engines/engine/cowl-flaps-norm', on(COWL) ? 1 : 0)

  // PANEL_LIGHT
  change('panel light', '/controls/lighting/panel-norm', on(PANEL_LIGHT))

  // BEACON_LIGHT
  change('beacon light', '/controls/lighting/beacon', on(BEACON_LIGHT))

  // NAV_LIGHT
  change('nav light', '/controls/lighting/nav-lights', on(NAV_LIGHT))

  // STROBE_LIGHT
  change('strobe light', '/controls/lighting/strobe', on(STROBE_LIGHT))

  // TAXI_LIGHT
  change('taxi light', '/controls/lighting/taxi-light', on(TAXI_LIGHT))

  // LANDING_LIGHT
  change('landing light', '/controls/lighting/landing-lights', on(LANDING_LIGHT))

})

device.on('error', function(err) {
  console.error('err', err)
})

// Top Green = 0x01 =   0001
// Left Green = 0x02 =  0010
// Right Green = 0x04 = 0100
//                      0111
//
// 0001 OR 0010 = 0011
// 0011 OR 0100 = 0111

// Top Red = 0x08
// Left Red = 0x10
// Right Red = 0x20

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Bitwise_Operators

// all green
//device.write([0x0, 0x01 | 0x02 | 0x04 ])

// nothing
//device.write([0x0, 0x0])

// all red
//device.write([0x0, 0x08 | 0x10 | 0x20 ])

// all green except right
//device.write([0x0, 0x01 | 0x02 | 0x04 ^ 0x04])

// lg, rg, tr
//device.write([0x0, 0x02 | 0x04 | 0x08])
