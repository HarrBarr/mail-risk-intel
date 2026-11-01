import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";

import { json, mockFetch, renderWithProviders } from "@/test/utils";

import { AddEmailDialog } from "./AddEmailDialog";

function setup() {
  const onClose = vi.fn();
  const utils = renderWithProviders(
    <Routes>
      <Route path="/" element={<AddEmailDialog open onClose={onClose} />} />
      <Route path="/emails/:id" element={<p>Detail page</p>} />
    </Routes>,
  );
  return { onClose, user: userEvent.setup({ applyAccept: false }), ...utils };
}

function fileOf(name: string, size: number, type = "text/plain") {
  const file = new File(["x"], name, { type });
  Object.defineProperty(file, "size", { value: size });
  return file;
}

describe("Add email dialog", () => {
  it("is a labelled modal dialog that closes on Escape", async () => {
    const { onClose, user } = setup();
    const dialog = screen.getByRole("dialog", { name: "Add email" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(screen.getByLabelText("Email text")).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });

  it("rejects empty text without calling the API", async () => {
    const fetch = mockFetch({});
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: "Add email" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Paste the email text first.");
    expect(screen.getByLabelText("Email text")).toHaveAttribute("aria-invalid", "true");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("shows the server's 422 detail inline", async () => {
    mockFetch({ "POST /api/emails": () => json({ detail: "Could not find any email text." }, 422) });
    const { user } = setup();
    await user.type(screen.getByLabelText("Email text"), "   hello");
    await user.click(screen.getByRole("button", { name: "Add email" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not find any email text.");
  });

  it("submits text and navigates to the new email", async () => {
    const fetch = mockFetch({ "POST /api/emails": () => json({ id: "abc123", status: "pending" }, 202) });
    const { user, onClose } = setup();
    await user.type(screen.getByLabelText("Email text"), "Subject: hi{Enter}{Enter}body");
    await user.click(screen.getByRole("button", { name: "Add email" }));
    expect(await screen.findByText("Detail page")).toBeInTheDocument();
    expect(onClose).toHaveBeenCalled();
    const [, init] = fetch.mock.calls[0]!;
    expect(JSON.parse(String(init?.body))).toEqual({ raw_text: "Subject: hi\n\nbody" });
  });

  describe("upload tab", () => {
    async function openUpload() {
      const ctx = setup();
      await ctx.user.click(screen.getByRole("tab", { name: "Upload file" }));
      return ctx;
    }

    it("rejects an unsupported file type", async () => {
      const fetch = mockFetch({});
      const { user } = await openUpload();
      await user.upload(screen.getByLabelText(/drop a file here/i), fileOf("photo.png", 1000, "image/png"));
      expect(await screen.findByRole("alert")).toHaveTextContent("isn't supported");
      await user.click(screen.getByRole("button", { name: "Upload" }));
      expect(fetch).not.toHaveBeenCalled();
    });

    it("rejects a file over 5 MB", async () => {
      const fetch = mockFetch({});
      const { user } = await openUpload();
      await user.upload(
        screen.getByLabelText(/drop a file here/i),
        fileOf("big.pdf", 6 * 1024 * 1024, "application/pdf"),
      );
      expect(await screen.findByRole("alert")).toHaveTextContent("The limit is 5 MB");
      expect(fetch).not.toHaveBeenCalled();
    });

    it("asks for a file when none is chosen", async () => {
      const { user } = await openUpload();
      await user.click(screen.getByRole("button", { name: "Upload" }));
      expect(await screen.findByRole("alert")).toHaveTextContent("Choose a .txt, .pdf or .eml file first.");
    });

    it("shows the server's 422 detail for an unreadable file", async () => {
      const fetch = mockFetch({
        "POST /api/emails": () => json({ detail: "Could not read text from this PDF." }, 422),
      });
      const { user } = await openUpload();
      await user.upload(
        screen.getByLabelText(/drop a file here/i),
        fileOf("scan.pdf", 2048, "application/pdf"),
      );
      expect(screen.getByText("scan.pdf")).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Upload" }));
      expect(await screen.findByRole("alert")).toHaveTextContent("Could not read text from this PDF.");
      expect(fetch.mock.calls[0]![1]?.body).toBeInstanceOf(FormData);
    });
  });
});
