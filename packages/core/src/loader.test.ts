import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Odontogram } from "./odontogram.js";
import { OdontogramError, OdontogramValidationError, VALIDATION_CODES } from "./errors.js";
import {
  DOCUMENT_MIXED_DENTITION_EXAMPLE,
  DOCUMENT_PERMANENT_RESTORATIONS_EXAMPLE,
  MULTI_SURFACE_RESTORATIONS_EXAMPLE,
  WHOLE_TOOTH_MARKS_EXAMPLE,
} from "./examples.js";
import type {
  DataLoadFailArg,
  OdontogramDataLoader,
  OdontogramErrorArg,
  OdontogramLoaderPayload,
} from "./types.js";

describe("Stage 07 · Data Loading & Concurrency Handling", () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  describe("Initial Data & Domain Isolation", () => {
    it("accepts initial static data snapshot synchronously at construction without backend/URL/auth", () => {
      const odontogram = new Odontogram(container, {
        initialData: MULTI_SURFACE_RESTORATIONS_EXAMPLE,
      });

      expect(odontogram.getMarks()).toHaveLength(3);
      expect(odontogram.hasMark("restoration-16-mod")).toBe(true);
      expect(odontogram.isDirty()).toBe(false);
      expect(odontogram.hasPendingEdits()).toBe(false);
    });

    it("accepts initial OdontogramDocument via data option and validates schema", () => {
      const odontogram = new Odontogram(container, {
        data: DOCUMENT_PERMANENT_RESTORATIONS_EXAMPLE,
      });

      expect(odontogram.getMarks()).toHaveLength(2);
      expect(odontogram.getToothPresence("18")).toBe("missing");
      expect(odontogram.isDirty()).toBe(false);
    });

    it("rejects invalid initial data with OdontogramValidationError", () => {
      const corruptData = {
        view: "permanent",
        teeth: { "16": { presence: "missing" as const } },
        marks: [
          {
            id: "bad-mark",
            type: "caries",
            target: { tooth: "16", surfaces: ["O" as const] },
          },
        ],
      };

      expect(() => new Odontogram(container, { initialData: corruptData })).toThrow(
        OdontogramValidationError,
      );
    });
  });

  describe("Async Loader & Lifecycle Callbacks", () => {
    it("automatically triggers loader on construction when autoload is true (default)", async () => {
      let loaderCalled = false;
      const loader: OdontogramDataLoader = async ({ signal }) => {
        loaderCalled = true;
        expect(signal).toBeInstanceOf(AbortSignal);
        expect(signal.aborted).toBe(false);
        return DOCUMENT_MIXED_DENTITION_EXAMPLE;
      };

      const loadingEvents: boolean[] = [];
      let successFired = false;

      const odontogram = new Odontogram(container, {
        loader,
        dataLoadingDidChange: ({ loading }) => {
          loadingEvents.push(loading);
        },
        dataDidLoad: ({ state }) => {
          successFired = true;
          expect(state.view).toBe("mixed");
        },
      });

      // Wait a tick for async loader
      await vi.waitFor(() => expect(successFired).toBe(true));

      expect(loaderCalled).toBe(true);
      expect(odontogram.getState().view).toBe("mixed");
      expect(odontogram.getMarks()).toHaveLength(2);
      expect(odontogram.isLoading()).toBe(false);
      expect(loadingEvents).toEqual([true, false]);
    });

    it("does not automatically trigger loader when autoload is false", async () => {
      let loaderCalled = false;
      const loader: OdontogramDataLoader = async () => {
        loaderCalled = true;
        return DOCUMENT_MIXED_DENTITION_EXAMPLE;
      };

      const odontogram = new Odontogram(container, {
        loader,
        autoload: false,
      });

      // Allow microtasks to run
      await new Promise((resolve) => setTimeout(resolve, 30));

      expect(loaderCalled).toBe(false);
      expect(odontogram.isLoading()).toBe(false);
      expect(odontogram.getState().view).toBe("permanent");
    });

    it("supports refetch() and passes context params and reason", async () => {
      let lastReason = "";
      let lastParams: Record<string, unknown> | undefined;

      const loader: OdontogramDataLoader = async (ctx) => {
        lastReason = ctx.reason;
        lastParams = ctx.params;
        return MULTI_SURFACE_RESTORATIONS_EXAMPLE;
      };

      const odontogram = new Odontogram(container, {
        loader,
        autoload: false,
      });

      const loadPromise = odontogram.refetch({
        params: { encounterId: "enc-999" },
      });

      expect(odontogram.isLoading()).toBe(true);
      const result = await loadPromise;

      expect(result.ok).toBe(true);
      expect(result.state.marks).toHaveLength(3);
      expect(lastReason).toBe("refetch");
      expect(lastParams).toEqual({ encounterId: "enc-999" });
      expect(odontogram.isLoading()).toBe(false);
    });

    it("supports loadData() with a custom loader function", async () => {
      const odontogram = new Odontogram(container);

      const customLoader: OdontogramDataLoader = async ({ signal, reason }) => {
        expect(signal.aborted).toBe(false);
        expect(reason).toBe("loadData");
        return WHOLE_TOOTH_MARKS_EXAMPLE;
      };

      const result = await odontogram.loadData(customLoader);
      expect(result.ok).toBe(true);
      expect(odontogram.hasMark("crown-36")).toBe(true);
      expect(odontogram.getToothPresence("18")).toBe("missing");
      expect(odontogram.isDirty()).toBe(false);
    });
  });

  describe("Validation Before Applying Results", () => {
    it("validates returned OdontogramDocument before applying; rejects corrupted payload and leaves state unchanged", async () => {
      const corruptDocument = {
        schemaVersion: "1.0.0",
        view: "permanent",
        teeth: { "16": { presence: "missing" } },
        marks: [
          // Surface mark on missing tooth
          { id: "m-bad", type: "caries", target: { tooth: "16", surfaces: ["O"] } },
        ],
      };

      const odontogram = new Odontogram(container, {
        initialData: MULTI_SURFACE_RESTORATIONS_EXAMPLE,
      });

      const previousState = odontogram.getState();
      const previousRev = odontogram.getRevision();

      const corruptLoader: OdontogramDataLoader = async () =>
        corruptDocument as unknown as OdontogramLoaderPayload;

      await expect(
        odontogram.loadData(corruptLoader, {
          strict: true,
        }),
      ).rejects.toThrow(OdontogramValidationError);

      // State and revision MUST be 100% unchanged
      expect(odontogram.getState()).toEqual(previousState);
      expect(odontogram.getRevision()).toBe(previousRev);
      expect(odontogram.hasMark("restoration-16-mod")).toBe(true);
      expect(odontogram.isLoading()).toBe(false);
    });

    it("fires dataLoadDidFail and errorDidOccur when loader throws an application error", async () => {
      let failedArg: DataLoadFailArg | null = null;
      let errorOccurArg: OdontogramErrorArg | null = null;

      const failingLoader: OdontogramDataLoader = async () => {
        throw new Error("Network timeout from custom EHR");
      };

      const odontogram = new Odontogram(container, {
        loader: failingLoader,
        autoload: false,
        dataLoadDidFail: (arg) => {
          failedArg = arg;
        },
        errorDidOccur: (arg) => {
          errorOccurArg = arg;
        },
      });

      await expect(odontogram.refetch()).rejects.toThrow("Network timeout from custom EHR");

      expect(failedArg).not.toBeNull();
      expect((failedArg!.error as Error).message).toBe("Network timeout from custom EHR");
      expect(failedArg!.aborted).toBe(false);

      expect(errorOccurArg).not.toBeNull();
      expect(errorOccurArg!.callback).toBe("loader");
      expect(odontogram.isLoading()).toBe(false);
    });
  });

  describe("Concurrency, Cancellation, Stale Responses & Destroy", () => {
    it("handles slow loads and updates loading state accurately", async () => {
      const loader: OdontogramDataLoader = async ({ signal }) => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        if (signal.aborted) throw new Error("Aborted");
        return DOCUMENT_PERMANENT_RESTORATIONS_EXAMPLE;
      };

      const odontogram = new Odontogram(container, { loader, autoload: false });
      expect(odontogram.isLoading()).toBe(false);

      const promise = odontogram.refetch();
      expect(odontogram.isLoading()).toBe(true);

      const result = await promise;
      expect(result.ok).toBe(true);
      expect(odontogram.isLoading()).toBe(false);
      expect(odontogram.hasMark("restoration-16-mod")).toBe(true);
    });

    it("aborts active in-flight request when a new refetch() is triggered", async () => {
      let signal1Aborted = false;
      let signal2Aborted = false;

      const loader: OdontogramDataLoader = async (ctx) => {
        if (ctx.params?.id === 1) {
          ctx.signal.addEventListener("abort", () => {
            signal1Aborted = true;
          });
          await new Promise((resolve) => setTimeout(resolve, 100));
          return DOCUMENT_PERMANENT_RESTORATIONS_EXAMPLE;
        } else {
          ctx.signal.addEventListener("abort", () => {
            signal2Aborted = true;
          });
          await new Promise((resolve) => setTimeout(resolve, 30));
          return DOCUMENT_MIXED_DENTITION_EXAMPLE;
        }
      };

      const odontogram = new Odontogram(container, { loader, autoload: false });

      // Trigger first request (slow)
      const promise1 = odontogram.refetch({ params: { id: 1 } });
      // Trigger second request immediately
      const promise2 = odontogram.refetch({ params: { id: 2 } });

      // First signal should have been aborted
      expect(signal1Aborted).toBe(true);

      const result2 = await promise2;
      expect(result2.state.view).toBe("mixed");

      // Verify promise1 was aborted/superseded
      try {
        await promise1;
      } catch (err: unknown) {
        expect((err as OdontogramError).code).toBe(VALIDATION_CODES.ERR_LOAD_ABORTED);
      }

      expect(odontogram.getState().view).toBe("mixed");
      expect(signal2Aborted).toBe(false);
    });

    it("ignores out-of-order stale responses", async () => {
      let resolveFirst: ((val: unknown) => void) | null = null;
      let resolveSecond: ((val: unknown) => void) | null = null;

      const loader: OdontogramDataLoader = (ctx) => {
        if (ctx.params?.call === "first") {
          return new Promise((resolve) => {
            resolveFirst = () => resolve(DOCUMENT_PERMANENT_RESTORATIONS_EXAMPLE);
          });
        } else {
          return new Promise((resolve) => {
            resolveSecond = () => resolve(DOCUMENT_MIXED_DENTITION_EXAMPLE);
          });
        }
      };

      const odontogram = new Odontogram(container, { loader, autoload: false });

      // Start call 1
      const p1 = odontogram.refetch({ params: { call: "first" } });
      // Start call 2 (superseding call 1)
      const p2 = odontogram.refetch({ params: { call: "second" } });

      // Resolve call 2 FIRST
      resolveSecond!({});
      const res2 = await p2;
      expect(res2.state.view).toBe("mixed");
      expect(odontogram.getState().view).toBe("mixed");

      // Resolve call 1 LATER (stale)
      resolveFirst!({});

      await expect(p1).rejects.toThrow();

      // State MUST remain "mixed" and not be overwritten by stale call 1!
      expect(odontogram.getState().view).toBe("mixed");
    });

    it("cancels in-flight request on destroy() and ignores late resolution", async () => {
      let signalAborted = false;
      let resolveLoader: ((val: unknown) => void) | null = null;

      const loader: OdontogramDataLoader = ({ signal }) => {
        signal.addEventListener("abort", () => {
          signalAborted = true;
        });
        return new Promise((resolve) => {
          resolveLoader = () => resolve(DOCUMENT_PERMANENT_RESTORATIONS_EXAMPLE);
        });
      };

      const odontogram = new Odontogram(container, { loader, autoload: false });
      const p = odontogram.refetch();

      expect(odontogram.isLoading()).toBe(true);

      // Destroy instance while request is in-flight
      odontogram.destroy();

      expect(signalAborted).toBe(true);
      expect(odontogram.isLoading()).toBe(false);

      // Resolve after destroy
      resolveLoader!({});

      await expect(p).rejects.toThrow();

      // Late resolution is dropped
      expect(odontogram.isLoading()).toBe(false);
    });

    it("cancels in-flight request when loader option is replaced", async () => {
      let loader1Aborted = false;

      const loader1: OdontogramDataLoader = ({ signal }) => {
        signal.addEventListener("abort", () => {
          loader1Aborted = true;
        });
        return new Promise((resolve) => setTimeout(resolve, 100));
      };

      const loader2: OdontogramDataLoader = async () => DOCUMENT_MIXED_DENTITION_EXAMPLE;

      const odontogram = new Odontogram(container, { loader: loader1, autoload: false });
      odontogram.refetch().catch(() => {});

      // Replace loader option
      odontogram.setOption("loader", loader2);

      expect(loader1Aborted).toBe(true);
    });
  });

  describe("Pending Local Edits & Safe Reload Protection", () => {
    it("tracks dirty state correctly when marks, tooth presence, or views are modified", () => {
      const odontogram = new Odontogram(container, {
        initialData: MULTI_SURFACE_RESTORATIONS_EXAMPLE,
      });

      expect(odontogram.isDirty()).toBe(false);
      expect(odontogram.hasPendingEdits()).toBe(false);

      // Add a mark -> becomes dirty
      odontogram.addMark({ tooth: "36", surfaces: ["O"], type: "caries" });
      expect(odontogram.isDirty()).toBe(true);
      expect(odontogram.hasPendingEdits()).toBe(true);

      // Mark clean -> resets dirty status
      odontogram.markClean();
      expect(odontogram.isDirty()).toBe(false);

      // Alter tooth presence -> becomes dirty
      odontogram.setToothState("18", "missing");
      expect(odontogram.isDirty()).toBe(true);
    });

    it("refuses to reload and throws ERR_UNSAVED_EDITS when pending local edits exist, preserving local edits", async () => {
      const loader: OdontogramDataLoader = async () => DOCUMENT_PERMANENT_RESTORATIONS_EXAMPLE;

      const odontogram = new Odontogram(container, {
        loader,
        initialData: MULTI_SURFACE_RESTORATIONS_EXAMPLE,
        autoload: false,
      });

      // Clinician makes local edits
      odontogram.addMark({
        id: "clinician-local-mark",
        tooth: "36",
        surfaces: ["O"],
        type: "caries",
      });
      expect(odontogram.hasPendingEdits()).toBe(true);

      let threw = false;
      try {
        await odontogram.refetch();
      } catch (err: unknown) {
        threw = true;
        expect(err).toBeInstanceOf(OdontogramError);
        expect((err as OdontogramError).code).toBe(VALIDATION_CODES.ERR_UNSAVED_EDITS);
      }

      expect(threw).toBe(true);

      // Local edit MUST NOT be overwritten!
      expect(odontogram.hasMark("clinician-local-mark")).toBe(true);
    });

    it("allows reloading and overwriting local edits when force: true is explicitly passed", async () => {
      const loader: OdontogramDataLoader = async () => DOCUMENT_MIXED_DENTITION_EXAMPLE;

      const odontogram = new Odontogram(container, {
        loader,
        initialData: MULTI_SURFACE_RESTORATIONS_EXAMPLE,
        autoload: false,
      });

      odontogram.addMark({
        id: "clinician-local-mark",
        tooth: "36",
        surfaces: ["O"],
        type: "caries",
      });
      expect(odontogram.hasPendingEdits()).toBe(true);

      // Force reload
      const result = await odontogram.refetch({ force: true });
      expect(result.ok).toBe(true);
      expect(result.state.view).toBe("mixed");

      // Local edit was intentionally overwritten
      expect(odontogram.hasMark("clinician-local-mark")).toBe(false);
      expect(odontogram.isDirty()).toBe(false);
    });

    it("allows unforced reload after markClean() is called", async () => {
      const loader: OdontogramDataLoader = async () => DOCUMENT_MIXED_DENTITION_EXAMPLE;

      const odontogram = new Odontogram(container, {
        loader,
        initialData: MULTI_SURFACE_RESTORATIONS_EXAMPLE,
        autoload: false,
      });

      odontogram.addMark({ tooth: "36", surfaces: ["O"], type: "caries" });
      expect(odontogram.hasPendingEdits()).toBe(true);

      // Simulate consumer saving edits to their backend and resetting baseline
      odontogram.markClean();
      expect(odontogram.hasPendingEdits()).toBe(false);

      // Now unforced refetch succeeds cleanly
      const result = await odontogram.refetch();
      expect(result.ok).toBe(true);
      expect(result.state.view).toBe("mixed");
    });
  });

  describe("Controlled Mode Interoperability", () => {
    it("supports data loading in mode: 'controlled' seamlessly", async () => {
      const loader: OdontogramDataLoader = async () => DOCUMENT_PERMANENT_RESTORATIONS_EXAMPLE;

      const odontogram = new Odontogram(container, {
        mode: "controlled",
        loader,
        autoload: false,
      });

      expect(odontogram.getMode()).toBe("controlled");

      const result = await odontogram.refetch({ source: "external" });
      expect(result.ok).toBe(true);
      expect(odontogram.hasMark("restoration-16-mod")).toBe(true);
      expect(odontogram.getToothPresence("18")).toBe("missing");
    });
  });
});
