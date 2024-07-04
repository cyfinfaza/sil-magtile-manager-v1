class ArduinoController {
  constructor() {
    this.port = null;
    this.writer = null;
    this.reader = null;
  }

  async connect() {
    try {
      this.port = await navigator.serial.requestPort();
      await this.port.open({ baudRate: 115200 });

      this.writer = this.port.writable.getWriter();
      this.reader = this.port.readable.getReader();

      // Flush initial message from Arduino
      await this.readUntilNewline();

      return { status: "success", data: "Connected to Arduino" };
    } catch (error) {
      return { status: "error", data: error.message };
    }
  }

  async disconnect() {
    try {
      if (this.writer) {
        await this.writer.close();
        this.writer.releaseLock();
      }
      if (this.reader) {
        await this.reader.cancel();
        this.reader.releaseLock();
      }
      if (this.port) {
        await this.port.close();
      }
      return { status: "success", data: "Disconnected from Arduino" };
    } catch (error) {
      return { status: "error", data: error.message };
    }
  }

  async readUntilNewline() {
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { value, done } = await this.reader.read();
      if (done) break;
      buffer += decoder.decode(value);
      const newlineIndex = buffer.indexOf("\n");
      if (newlineIndex !== -1) {
        const line = buffer.substring(0, newlineIndex + 1).trim();
        return line;
      }
    }
    return null;
  }

  async sendCommand(command) {
    try {
      console.log("⬆️ Sending command: " + command);
      const encoder = new TextEncoder();
      await this.writer.write(encoder.encode(command + "\n"));

      const response = await this.readUntilNewline();

      console.log("⬇️ Received response: " + response);

      if (response.startsWith("ok : ")) {
        return { status: "success", data: response.substring(5) };
      } else if (response === "error") {
        return { status: "error", data: "Command error" };
      } else {
        return { status: "error", data: "Unknown response" };
      }
    } catch (error) {
      return { status: "error", data: error.message };
    }
  }

  async readWidth() {
    return await this.sendCommand("read_width");
  }

  async readHeight() {
    return await this.sendCommand("read_height");
  }

  async writeWidth(value) {
    return await this.sendCommand(`write_width ${value}`);
  }

  async writeHeight(value) {
    return await this.sendCommand(`write_height ${value}`);
  }

  async writeAddressList(list) {
    return await this.sendCommand(`write_address_list ${list.join(" ")}`);
  }

  async readAddressList() {
    return await this.sendCommand("read_address_list");
  }

  async scanAddresses() {
    return await this.sendCommand("scan_addresses");
  }

  async blinkallStart() {
    return await this.sendCommand("blinkall_start");
  }

  async blinkallStop() {
    return await this.sendCommand("blinkall_stop");
  }

  async testLedEnable(address) {
    return await this.sendCommand(`test_led_enable ${address}`);
  }

  async testLedDisable(address) {
    return await this.sendCommand(`test_led_disable ${address}`);
  }

  async storeConfig() {
    return await this.sendCommand("store_config");
  }

  async setPower(row, col, power) {
    return await this.sendCommand(`set_power ${row} ${col} ${power}`);
  }

  async getPower(row, col) {
    return await this.sendCommand(`get_power ${row} ${col}`);
  }
}

export default ArduinoController;
