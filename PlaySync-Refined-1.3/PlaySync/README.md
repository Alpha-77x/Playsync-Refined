# PlaySync Refined 1.3

This build is a focused gameplay/controls pass on the original PlaySync structure.

## Fixed
- Slip N Bump round timer now starts after the countdown instead of expiring immediately.
- Phone joystick now sends an analog `MOVE_AXIS:x,y` vector, so movement follows the direction of the stick instead of turning in circles.
- Cyber Tank movement is now direct 8-way movement; the tank faces the movement direction.
- Keyboard controls remain supported for local test mode.
- Both games have stronger round flow, hit feedback, particles, power-ups/effects, and clearer HUD timing.

## Run

From the folder containing `package.json`:

```bash
npm install
npm start
```

Open `http://localhost:3000/host.html`.

For one-device testing, launch a game in local test mode. For phone testing, scan the QR code and use the controller page.

## Controls

### Keyboard test mode
- W/A/S/D or Arrow Keys: move
- Space: primary action / dash or fire
- Shift: shield / boost
- Esc: overlay

### Phone controller
- Drag the joystick in the direction you want to move.
- Action A: dash / fire
- Action B: shield / boost depending on the game

## Validation performed
- JavaScript syntax checked for server, room, host app, registry, and controller code.
- Both game modules were initialized in a canvas test harness for several seconds.
- Analog `MOVE_AXIS` input was exercised in the game harness.
