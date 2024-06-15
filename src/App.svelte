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
    let resp = await comm.connect();
    if (resp.status == "success") {
      connected = true;
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

  onMount(() => {
    return async () => {
      await comm.disconnect();
    };
  });
</script>

<main>
  <div class="topBar">
    <button on:click={connect} disabled={connected}
      >{connected ? "🔌 Connected" : "🔌 Connect"}</button
    >
    <button on:click={readConfig}>⬇️ Read Config</button>
    <button on:click={writeConfig}>⬆️ Test Config</button>
    <button on:click={storeToEeprom}>💾 Store Config to EEPROM</button>
  </div>
  <div class="panels">
    <div class="scanAddr">
      <h3>Scan for MagTiles</h3>
      <button on:click={doScan}>🔍 Scan now</button>
      {#each scannedAddrs as addr}
        <p>
          <button
            class:lightOn={ledStates[addr]}
            on:click={() => toggleLed(addr)}>💡</button
          >
          {addr}
        </p>
      {/each}
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
        <p style="display: flex; align-items:center;">
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
  main {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 8px;
  }
  .topBar,
  .panels {
    display: flex;
    gap: 8px;
  }
  .panels {
    gap: 8px;
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
    }
  }
  .addrGrid {
    display: flex;
    flex-direction: column;
    gap: 8px;
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
    .ctrlGridRow {
      display: flex;
      gap: 4px;
    }
    .ctrlGridCoil {
      background-color: #0002;
      padding: 4px;
      width: 2em;
      height: 2em;
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
