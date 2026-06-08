/**
 * Tesults API reference: https://www.tesults.com/docs/api/overview
 * This script creates a new Tesults target for the current branch if it doesn't exist,
 * or regenerates the token for the existing target if it does exist.
 * The script also deletes the target if the branch is deleted.
 */
const fetch = require("node-fetch");
const fs = require("fs").promises;
const { argv } = require("process");

const repoName = "playwright-boilerplate";
const desiredTargetName = `${repoName}_${process.env.BRANCH}`;
const apiToken = process.env.TESULTS_API_TOKEN;

async function sendCreateRequest(apiToken, desiredTargetName, repoName) {
  let body = JSON.stringify({
    name: desiredTargetName,
    group: [repoName],
    build_consolidation: true,
    public: true,
  });

  let requestOptions = {
    method: "POST",
    headers: {
      Authorization: "Bearer " + apiToken,
      "Content-Type": "application/json",
    },
    body: body,
  };

  try {
    console.log("creating target: " + desiredTargetName);
    const res = await fetch(
      "https://www.tesults.com/api/targets",
      requestOptions
    );
    return await res.json();
  } catch (error) {
    console.log("send create request error", error);
    throw error;
  }
}

async function sendDeleteRequest(apiToken, targetId) {
  let requestOptions = {
    method: "DELETE",
    headers: {
      Authorization: "Bearer " + apiToken,
    },
  };

  try {
    console.log("deleting target...");
    const res = await fetch(
      "https://www.tesults.com/api/targets/" + targetId,
      requestOptions
    );
    return await res.json();
  } catch (error) {
    console.log("send delete request error", error);
    throw error;
  }
}

async function sendGetTargetsRequest(apiToken) {
  let requestOptions = {
    method: "GET",
    headers: {
      Authorization: "Bearer " + apiToken,
    },
  };

  try {
    const res = await fetch(
      "https://www.tesults.com/api/targets",
      requestOptions
    );
    return await res.json();
  } catch (error) {
    console.log("set get request error", error);
    throw error;
  }
}

async function sendRegenerateTargetTokenRequest(apiToken, targetId) {
  let requestOptions = {
    method: "POST",
    headers: {
      Authorization: "Bearer " + apiToken,
      "Content-Type": "application/json",
    },
  };

  try {
    const res = await fetch(
      `https://www.tesults.com/api/targets/${targetId}/regenerate_token`,
      requestOptions
    );
    return await res.json();
  } catch (error) {
    console.log("send regenerate token request error", error);
    throw error;
  }
}

function findTargetId(currentTargets, targetName) {
  for (let currentTarget of currentTargets) {
    if (currentTarget.name === targetName) {
      return currentTarget.id;
    }
  }
  return null;
}

function isTargetExist(currentTargets, targetName) {
  for (let currentTarget of currentTargets) {
    if (currentTarget.name === targetName) {
      console.log("target exists");
      return true;
    }
  }
  return false;
}

function assertTargetsResponse(res) {
  if (res && res.error) {
    throw new Error(
      `Tesults API error ${res.error.code}: ${res.error.message}`
    );
  }
  if (!res || !res.data || !res.data.targets) {
    throw new Error(
      "Invalid response from Tesults API: " + JSON.stringify(res)
    );
  }
}

async function createTarget(apiToken, desiredTargetName, repoName) {
  try {
    const res = await sendGetTargetsRequest(apiToken);

    assertTargetsResponse(res);

    let newToken;
    if (!isTargetExist(res.data.targets, desiredTargetName)) {
      const createRes = await sendCreateRequest(apiToken, desiredTargetName, repoName);
      newToken = createRes.data.token;
    } else {
      console.log(
        "regenerating token for existing target: " + desiredTargetName
      );
      const regenerateRes = await sendRegenerateTargetTokenRequest(
        apiToken,
        findTargetId(res.data.targets, desiredTargetName)
      );
      newToken = regenerateRes.data.token;
    }

    console.log(
      "setting tesults token for created target: " + desiredTargetName
    );
    await fs.writeFile("tesultsToken.txt", newToken);
    console.log("tesults token > tesultsToken.txt");
  } catch (error) {
    console.error("Error in createTarget:", error);
    process.exit(1);
  }
}

async function deleteTarget(apiToken, desiredTargetName) {
  try {
    const res = await sendGetTargetsRequest(apiToken);

    assertTargetsResponse(res);

    const targetId = findTargetId(res.data.targets, desiredTargetName);
    const deleteRes = await sendDeleteRequest(apiToken, targetId);
    console.log(deleteRes);
  } catch (error) {
    console.error("Error in deleteTarget:", error);
    process.exit(1);
  }
}

async function main() {
  if (!apiToken) {
    console.error(
      "TESULTS_API_TOKEN is not set. If this is a pull request from a fork, " +
        "GitHub does not expose secrets to fork PRs. Otherwise, set the " +
        "TESULTS_API_TOKEN secret in the repository settings."
    );
    process.exit(1);
  }

  switch (argv[2]) {
    case "create":
      await createTarget(apiToken, desiredTargetName, repoName);
      break;
    case "delete":
      await deleteTarget(apiToken, desiredTargetName);
      break;
    default:
      console.log("no target action specified, exiting...");
  }
}

main();
