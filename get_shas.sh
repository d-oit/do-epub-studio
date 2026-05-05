for action in "actions/checkout/v4.2.2" "actions/setup-node/v4.2.0" "pnpm/action-setup/v4.1.0" "actions/upload-artifact/v4.6.0" "cloudflare/wrangler-action/v3.15.0" "softprops/action-gh-release/v2.2.1" "dependabot/fetch-metadata/v2.3.0"; do
    repo=$(echo $action | cut -d'/' -f1,2)
    tag=$(echo $action | cut -d'/' -f3)
    echo "Checking $repo @ $tag"
    curl -s -H "Accept: application/vnd.github.v3+json" "https://api.github.com/repos/$repo/commits/$tag" | grep '"sha":' | head -n 1
done
