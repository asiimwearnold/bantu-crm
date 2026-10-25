import type { Metadata } from "next";
import { Suspense } from "react";
import {
	PageShell,
	PageShellContent,
	PageShellDescription,
	PageShellFallback,
	PageShellHeader,
	PageShellHeading,
	PageShellTitle,
} from "@/components/page-shell";
import { requireSession } from "@/lib/session";
import { HydrateClient } from "@/lib/trpc/hydrate";
import { getServerQueryClient, getServerTrpc } from "@/lib/trpc/server";
import { BantuWorkspace } from "./bantu-workspace";

export const metadata: Metadata = { title: "BANTU" };

export default function BantuPage() {
	return (
		<Suspense fallback={<PageShellFallback />}>
			<BantuPageContent />
		</Suspense>
	);
}

async function BantuPageContent() {
	await requireSession();
	const queryClient = getServerQueryClient();
	await queryClient.prefetchQuery(getServerTrpc().bantu.list.queryOptions());

	return (
		<PageShell>
			<PageShellHeader>
				<PageShellHeading>
					<PageShellTitle>BANTU</PageShellTitle>
					<PageShellDescription>
						Describe a repository task. BANTU tests and reviews changes, then
						pushes a branch for you to review.
					</PageShellDescription>
				</PageShellHeading>
			</PageShellHeader>
			<PageShellContent>
				<HydrateClient>
					<BantuWorkspace />
				</HydrateClient>
			</PageShellContent>
		</PageShell>
	);
}
