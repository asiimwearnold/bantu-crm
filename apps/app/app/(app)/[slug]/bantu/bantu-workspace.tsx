"use client";

import { Button } from "@crm/ui/components/button";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@crm/ui/components/card";
import { Checkbox } from "@crm/ui/components/checkbox";
import { Input } from "@crm/ui/components/input";
import { Textarea } from "@crm/ui/components/textarea";
import { useMutation, useQuery } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import { useTRPC } from "@/lib/trpc/client";

export function BantuWorkspace() {
	const trpc = useTRPC();
	const tasks = useQuery({
		...trpc.bantu.list.queryOptions(),
		refetchInterval: 10_000,
	});
	const [repository, setRepository] = useState("");
	const [request, setRequest] = useState("");

	const create = useMutation(
		trpc.bantu.create.mutationOptions({
			onSuccess: async () => {
				setRepository("");
				setRequest("");
				await tasks.refetch();
				toast.success("BANTU task submitted for approval.");
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		create.mutate({ repository, request });
	}

	if (tasks.isPending) {
		return (
			<p className="text-muted-foreground text-sm">Loading BANTU tasks…</p>
		);
	}

	if (tasks.isError) {
		return (
			<p role="alert" className="text-destructive text-sm">
				{tasks.error.message}
			</p>
		);
	}

	return (
		<div className="flex flex-col gap-6">
			<Card>
				<CardHeader>
					<CardTitle>Start a task</CardTitle>
				</CardHeader>
				<CardContent>
					<form className="flex flex-col gap-4" onSubmit={submit}>
						<label
							htmlFor="bantu-repository"
							className="flex flex-col gap-2 text-sm font-medium"
						>
							Public Git repository URL
							<Input
								id="bantu-repository"
								required
								type="url"
								placeholder="https://github.com/owner/repository"
								value={repository}
								onChange={(event) => setRepository(event.target.value)}
							/>
						</label>
						<label
							htmlFor="bantu-request"
							className="flex flex-col gap-2 text-sm font-medium"
						>
							Describe the work
							<Textarea
								id="bantu-request"
								required
								minLength={20}
								maxLength={5000}
								placeholder="Describe the change, expected behavior, and how BANTU should verify it."
								value={request}
								onChange={(event) => setRequest(event.target.value)}
							/>
						</label>
						<p className="text-muted-foreground text-sm">
							A workspace owner or admin must approve each task. Approval
							confirms repository rights and allows BANTU to push a task branch.
							BANTU does not merge or deploy changes.
						</p>
						<div>
							<Button type="submit" disabled={create.isPending}>
								{create.isPending ? "Submitting…" : "Submit for approval"}
							</Button>
						</div>
					</form>
				</CardContent>
			</Card>

			{!tasks.data.workerConfigured ? (
				<p role="status" className="text-muted-foreground text-sm">
					BANTU worker credentials are not configured. Tasks can be drafted, but
					cannot run.
				</p>
			) : null}

			<section
				aria-labelledby="bantu-tasks-heading"
				className="flex flex-col gap-3"
			>
				<h2 id="bantu-tasks-heading" className="font-medium text-lg">
					Tasks
				</h2>
				{tasks.data.tasks.length ? (
					tasks.data.tasks.map((task) => (
						<BantuTaskCard
							key={task.id}
							task={task}
							canApprove={tasks.data.canApprove}
							onChanged={tasks.refetch}
						/>
					))
				) : (
					<p className="text-muted-foreground text-sm">No BANTU tasks yet.</p>
				)}
			</section>
		</div>
	);
}

function BantuTaskCard({
	task,
	canApprove,
	onChanged,
}: {
	task: {
		id: string;
		repository: string;
		request: string;
		status: string;
		branch: string | null;
		report: string | null;
		failure: string | null;
		createdAt: string;
		createdBy: string;
	};
	canApprove: boolean;
	onChanged: () => Promise<unknown>;
}) {
	const trpc = useTRPC();
	const [confirmRights, setConfirmRights] = useState(false);

	const approve = useMutation(
		trpc.bantu.approve.mutationOptions({
			onSuccess: async () => {
				await onChanged();
				toast.success("BANTU task approved.");
			},
			onError: (error) => toast.error(error.message),
		}),
	);
	const retry = useMutation(
		trpc.bantu.retry.mutationOptions({
			onSuccess: async () => {
				await onChanged();
				toast.success("BANTU task queued for retry.");
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	return (
		<Card>
			<CardHeader>
				<div className="flex flex-wrap items-start justify-between gap-3">
					<div className="flex min-w-0 flex-col gap-1">
						<CardTitle className="break-all text-base">
							{task.repository}
						</CardTitle>
						<p className="text-muted-foreground text-xs">
							{task.status} · requested by {task.createdBy} ·{" "}
							<time dateTime={task.createdAt}>
								{new Date(task.createdAt).toLocaleString()}
							</time>
						</p>
					</div>
					{canApprove && task.status === "DRAFT" ? (
						<div className="flex flex-col items-start gap-2 sm:items-end">
							<label
								htmlFor={`bantu-rights-${task.id}`}
								className="flex items-center gap-2 text-sm"
							>
								<Checkbox
									id={`bantu-rights-${task.id}`}
									checked={confirmRights}
									onCheckedChange={(checked) =>
										setConfirmRights(checked === true)
									}
								/>
								I confirm repository rights
							</label>
							<Button
								disabled={!confirmRights || approve.isPending}
								onClick={() =>
									approve.mutate({
										id: task.id,
										confirmRepositoryRights: true,
									})
								}
							>
								{approve.isPending ? "Approving…" : "Approve task"}
							</Button>
						</div>
					) : null}
					{canApprove && ["FAILED", "PAUSED"].includes(task.status) ? (
						<Button
							variant="outline"
							disabled={retry.isPending}
							onClick={() => retry.mutate({ id: task.id })}
						>
							{retry.isPending ? "Queuing…" : "Retry"}
						</Button>
					) : null}
				</div>
			</CardHeader>
			<CardContent className="flex flex-col gap-3">
				<p className="whitespace-pre-wrap text-sm">{task.request}</p>
				{task.branch ? (
					<p className="text-sm">
						Pushed branch: <code>{task.branch}</code>
					</p>
				) : null}
				{task.failure ? (
					<p role="alert" className="text-destructive text-sm">
						{task.failure}
					</p>
				) : null}
				{task.report ? (
					<details className="text-sm">
						<summary className="cursor-pointer font-medium">Run report</summary>
						<pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-3 text-xs">
							{task.report}
						</pre>
					</details>
				) : null}
			</CardContent>
		</Card>
	);
}
