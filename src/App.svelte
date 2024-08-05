<script>
  import { onMount } from "svelte";
  import MagTileCommunicator from "./lib/MagTileCommunicator";

  let rows = 3;
  let cols = 3;
  let addrList = [];

  let deviceRows = 2;
  let deviceCols = 2;
  let scannedAddrs = [];
  let ledStates = {};

  let coilStates = [];

  let connected = false;

  let comm = new MagTileCommunicator();

  window.comm = comm;

  async function connect() {
    if (connected) {
      await comm.disconnect();
      connected = false;
      return;
    }
    let resp = await comm.connect();
    if (resp.status == "success") {
      connected = true;
      comm.ondisconnect = () => {
        connected = false;
        // alert("Serial link lost.");
        // if (confirm("Serial link lost. Refresh page?"))
        //   window.location.reload();
      };
    } else {
      alert("Failed to connect: " + resp.data);
    }
  }

  async function doScan() {
    let resp = await comm.scanAddresses();
    if (resp.status == "success") {
      scannedAddrs = resp.data.split(" ").map((x) => parseInt(x));
      scannedAddrs = scannedAddrs.filter((x) => x != 112);
      // populate led states with all off
      ledStates = {};
      for (let addr of scannedAddrs) {
        ledStates[addr] = false;
      }
    } else {
      alert("Failed to scan: " + resp.data);
    }
  }

  async function setLedStates(ledStates) {
    for (let addr in ledStates) {
      let resp;
      console.log("Setting led state", addr, ledStates[addr]);
      if (ledStates[addr]) {
        resp = await comm.testLedEnable(addr);
      } else {
        resp = await comm.testLedDisable(addr);
      }
      if (resp.status != "success") {
        alert("Failed to set led state: " + resp.data);
      }
    }
  }

  $: {
    console.log("ledStates", ledStates);
    setLedStates(ledStates);
  }

  function toggleLed(addr) {
    ledStates[addr] = !ledStates[addr];
  }

  async function readConfig() {
    let resp;
    resp = await comm.readHeight();
    if (resp.status != "success") {
      alert("Failed to read height: " + resp.data);
    }
    console.log("height", resp.data);
    rows = parseInt(resp.data);
    if (rows > 8) {
      alert("Invalid number of rows: " + rows);
      rows = 0;
    }
    deviceRows = rows;
    resp = await comm.readWidth();
    if (resp.status != "success") {
      alert("Failed to read width: " + resp.data);
    }
    console.log("width", resp.data);
    cols = parseInt(resp.data);
    if (cols > 8) {
      alert("Invalid number of cols: " + cols);
      cols = 0;
    }
    deviceCols = cols;
    resp = await comm.readAddressList();
    if (resp.status != "success") {
      alert("Failed to read address list: " + resp.data);
    }
    console.log("address list", resp.data);
    addrList = resp.data.split(" ").map((x) => parseInt(x));
    // remove any addresses > 128
    addrList = addrList.filter((x) => x < 128);
    // populate coil states 2d array (device rows * 3 x device cols * 3) with all zero
    coilStates = Array(deviceRows * 3)
      .fill(0)
      .map(() => Array(deviceCols * 3).fill(0));
    console.log("coilStates", deviceRows, deviceCols, coilStates);
  }

  async function writeConfig() {
    let resp;
    resp = await comm.writeHeight(rows);
    if (resp.status != "success") {
      alert("Failed to write height: " + resp.data);
    }
    resp = await comm.writeWidth(cols);
    if (resp.status != "success") {
      alert("Failed to write width: " + resp.data);
    }
    resp = await comm.writeAddressList(addrList);
    if (resp.status != "success") {
      alert("Failed to write address list: " + resp.data);
    }
  }

  async function storeToEeprom() {
    let resp = await comm.storeConfig();
    if (resp.status != "success") {
      alert("Failed to store to EEPROM: " + resp.data);
    }
  }

  let selectedCoil = null;

  let pendingUpdates = [];

  async function updateCoilPower(row, col, power) {
    // add to pending updates
    pendingUpdates.push([row, col, power]);
    // debounce updates
    while (pendingUpdates.length > 0) {
      let [row, col, power] = pendingUpdates.shift();
      let resp = await comm.setPower(row, col, power);
      if (resp.status != "success") {
        alert("Failed to set coil power: " + resp.data);
      }
    }
  }

  let quickInc = 100;

  let setVal = 0;

  onMount(() => {
    return async () => {
      await comm.disconnect();
    };
  });
</script>

<main>
  <div class="topBar">
    <div
      style="height: 2em; width: 2em; border-radius: 50%; align-self: center;"
      style:background-color={connected ? "#0f0" : "#f00"}
    ></div>
    <button on:click={connect}
      >{connected ? "🔌 Disconnect" : "🔌 Connect"}</button
    >
    <button on:click={readConfig} disabled={!connected}>⬇️ Read Config</button>
    <button on:click={writeConfig} disabled={!connected}
      >⬆️ Send Config to RAM</button
    >
    <button on:click={storeToEeprom} disabled={!connected}
      >💾 Store RAM Config to EEPROM</button
    >
    <small>{__COMMIT_HASH__}</small>
  </div>
  <div class="panels">
    <div class="scanAddr">
      <h3>Scan for MagTiles</h3>
      <button on:click={doScan} disabled={!connected}>🔍 Scan now</button>
      <div
        style="display: flex; flex-wrap: wrap; gap: 12px; max-width: 300px; overflow: auto;"
      >
        {#each scannedAddrs as addr}
          <p>
            <button
              disabled={!connected}
              class:lightOn={ledStates[addr]}
              on:click={() => toggleLed(addr)}>💡</button
            >
            <code>{addr}</code>
          </p>
        {/each}
      </div>
      <!-- blinkall_start and stop -->
      <p>Blink all outputs on <br />all scanned tiles &darr;</p>
      <p>
        <button disabled={!connected} on:click={() => comm.blinkallStart()}
          >🟢 Start</button
        >
        <button disabled={!connected} on:click={() => comm.blinkallStop()}
          >🛑 Stop</button
        >
      </p>
    </div>
    <div class="gridConfig">
      <h3>Configure Grid</h3>
      <p>Columns: <input type="number" min="1" max="8" bind:value={cols} /></p>
      <p>Rows: <input type="number" min="1" max="8" bind:value={rows} /></p>
      <h4>Set Tile Addresses</h4>
      <!-- Grid of text boxes of size rows x cols -->
      <div class="addrGrid">
        {#each Array(rows) as _, row}
          <div class="addrGridRow">
            {#each Array(cols) as _, col}
              <div style="display: flex; flex-direction: column;">
                <input
                  style="display: block; border-radius: 8px 8px 0 0; "
                  type="text"
                  bind:value={addrList[row * cols + col]}
                />
                <button
                  disabled={!connected}
                  style="border-radius: 0 0 8px 8px; font-size: 0.7em; padding: 4px;"
                  on:click={() => toggleLed(addrList[row * cols + col])}
                  class:lightOn={ledStates[addrList[row * cols + col]]}
                >
                  💡
                </button>
              </div>
            {/each}
          </div>
        {/each}
      </div>
    </div>
    <div class="gridControl">
      <h3>Grid Control</h3>
      {#if selectedCoil != null}
        <p style="display: flex; align-items: center; gap:4px;">
          {selectedCoil[0]}, {selectedCoil[1]}
          <input
            type="range"
            min="0"
            step="5"
            max="4095"
            on:change={() => {
              updateCoilPower(
                selectedCoil[0],
                selectedCoil[1],
                coilStates[selectedCoil[0]][selectedCoil[1]]
              );
            }}
            bind:value={coilStates[selectedCoil[0]][selectedCoil[1]]}
          />
          {coilStates[selectedCoil[0]][selectedCoil[1]]}
        </p>
        <p style="display: flex; align-items: center; gap:4px;">
          Increment:
          <button
            on:click={() => {
              if (
                coilStates[selectedCoil[0]][selectedCoil[1]] + quickInc >
                4095
              )
                coilStates[selectedCoil[0]][selectedCoil[1]] = 4095;
              else coilStates[selectedCoil[0]][selectedCoil[1]] += quickInc;
              updateCoilPower(
                selectedCoil[0],
                selectedCoil[1],
                coilStates[selectedCoil[0]][selectedCoil[1]]
              );
            }}
            disabled={!connected}>+</button
          >
          <input type="number" style="width: 64px;" bind:value={quickInc} />
          <button
            disabled={!connected}
            on:click={() => {
              if (coilStates[selectedCoil[0]][selectedCoil[1]] < quickInc)
                coilStates[selectedCoil[0]][selectedCoil[1]] = 0;
              else coilStates[selectedCoil[0]][selectedCoil[1]] -= quickInc;
              updateCoilPower(
                selectedCoil[0],
                selectedCoil[1],
                coilStates[selectedCoil[0]][selectedCoil[1]]
              );
            }}>-</button
          >
        </p>
        <p style="display: flex; align-items: center; gap:4px;">
          Set value: <input
            type="number"
            bind:value={setVal}
            style="width: 64px;"
          />
          <button
            disabled={!connected}
            on:click={() => {
              coilStates[selectedCoil[0]][selectedCoil[1]] = setVal;
              updateCoilPower(
                selectedCoil[0],
                selectedCoil[1],
                coilStates[selectedCoil[0]][selectedCoil[1]]
              );
            }}>Set</button
          >
          <button
            disabled={!connected}
            on:click={() => {
              if (coilStates[selectedCoil[0]][selectedCoil[1]] == 0)
                coilStates[selectedCoil[0]][selectedCoil[1]] = setVal;
              else coilStates[selectedCoil[0]][selectedCoil[1]] = 0;
              updateCoilPower(
                selectedCoil[0],
                selectedCoil[1],
                coilStates[selectedCoil[0]][selectedCoil[1]]
              );
            }}>Toggle</button
          >
        </p>
      {/if}
      <div class="ctrlGrid">
        {#each coilStates as row, rowInd}
          <div class="ctrlGridRow">
            {#each row as col, colInd}
              <button
                class="ctrlGridCoil"
                class:selected={selectedCoil != null &&
                  selectedCoil[0] == rowInd &&
                  selectedCoil[1] == colInd}
                on:click={() => {
                  if (
                    selectedCoil == null ||
                    selectedCoil[0] != rowInd ||
                    selectedCoil[1] != colInd
                  )
                    selectedCoil = [rowInd, colInd];
                  else {
                    selectedCoil = null;
                  }
                }}
              >
                <div style="font-size: 0.5em;">{rowInd}, {colInd}</div>
                <div style="font-size: 0.7em;">{col}</div>
              </button>
            {/each}
          </div>
        {/each}
      </div>
    </div>
  </div>
</main>

<style lang="scss">
  button:disabled {
    background-color: #0002;
    color: #0004;
    pointer-events: none;
  }
  main {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 8px;
    max-height: 100vh;
    max-width: 100vw;
    box-sizing: border-box;
  }
  .topBar,
  .panels {
    display: flex;
    gap: 8px;
  }
  .topBar {
    align-items: flex-end;
  }
  .panels {
    gap: 8px;
    max-height: 100%;
    > * {
      background-color: #0002;
      padding: 8px;
      border-radius: 8px;
      h3,
      p,
      h4 {
        margin: 0;
      }
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 8px;
      overflow: hidden;
    }
    overflow: hidden;
  }
  .addrGrid {
    display: flex;
    flex-direction: column;
    gap: 8px;
    overflow: auto;
    max-width: 100%;
    .addrGridRow {
      display: flex;
      gap: 8px;
    }
    input {
      width: 2em;
      text-align: center;
      border-radius: 0;
    }
  }
  .ctrlGrid {
    display: flex;
    flex-direction: column;
    gap: 4px;
    overflow: auto;
    max-width: 100%;
    align-items: flex-start;
    .ctrlGridRow {
      display: flex;
      gap: 4px;
    }
    .ctrlGridCoil {
      background-color: #0002;
      padding: 4px;
      width: 2em;
      height: 2em;
      // flex: 0;
      border-radius: 50%;
      text-align: center;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      gap: 0px;
      cursor: pointer;
      &.selected {
        background-color: #000;
        color: #fff;
      }
    }
  }
  .lightOn {
    background-color: #00f;
  }
</style>
