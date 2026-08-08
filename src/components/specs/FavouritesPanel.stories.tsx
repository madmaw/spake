import type { Meta, StoryObj } from "@storybook/react-vite";
import { FavouritesPanel } from "src/components/FavouritesPanel";
import { fn } from "storybook/test";

const meta = {
    args: {
        onRemove: fn(),
    },
    component: FavouritesPanel,
} satisfies Meta<typeof FavouritesPanel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
    args: {
        favourites: [
            { id: "1", text: "Yes" },
            { id: "2", text: "No" },
            { id: "3", text: "I've lost my voice" },
            { id: "4", text: "Can I have some water?" },
        ],
    },
};

export const Empty: Story = {
    args: {
        favourites: [],
    },
};
