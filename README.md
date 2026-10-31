# Deye Flow Card

Home Assistant card for a Deye hybrid inverter: live power of PV, grid, battery and load.

One JavaScript file, no build step, no dependencies. Read-only: the card only shows states, it does not control anything.

> Work in progress. The card now shows the five values as plain text; the flow diagram comes next.

## Install (HACS)

1. HACS → ⋮ → Custom repositories → paste this repository URL, category **Dashboard** → Add.
2. Open **Deye Flow Card** in HACS → Download.
3. Reload the browser page.

HACS adds the dashboard resource automatically.

## Example

```yaml
type: custom:deye-flow-card-dev
pv: sensor.deye_inverter_pv_power
grid: sensor.deye_inverter_grid_power
battery: sensor.deye_inverter_battery_power
battery_soc: sensor.deye_inverter_battery
load: sensor.deye_inverter_load_power
```

| Key | Required | Meaning |
|---|---|---|
| `pv` | yes | PV power, W or kW |
| `grid` | yes | Grid power, W or kW |
| `battery` | yes | Battery power, W or kW |
| `battery_soc` | yes | Battery state of charge, % |
| `load` | yes | Load power, W or kW |
| `title` | no | Card title; `''` hides it |

If a required key is missing, the card shows an error that names the key.
