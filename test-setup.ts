import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Testing-library only auto-registers cleanup when vitest globals are on;
// this repo keeps globals off, so it is registered here explicitly.
afterEach(cleanup);
