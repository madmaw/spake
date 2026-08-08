import type { Meta, StoryObj } from "@storybook/react-vite";
import { WordWheel } from "src/components/WordWheel";
import { fn } from "storybook/test";

const meta = {
    args: {
        onCapacityChange: fn(),
        onPushBack: fn(),
        onReorder: fn(),
        onSelect: fn(),
        onTrash: fn(),
    },
    component: WordWheel,
    decorators: [
        (Story) => (
            <div style={{ height: "100vh", position: "relative" }}>
                <Story />
            </div>
        ),
    ],
} satisfies Meta<typeof WordWheel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
    args: {
        onMore: fn(),
        words: [
            "I",
            "I'm",
            "Can",
            "Please",
            "Yes",
            "No",
            "Thank",
            "My",
            "It",
            "What",
            "Where",
            "How",
            "Do",
            "Are",
            "The",
            "We",
            "Sorry",
            "Help",
            "Water",
            "Not",
            "That",
            "Good",
        ],
    },
};

export const FewWords: Story = {
    args: {
        onMore: null,
        words: ["you", "please", "water", "help", "now"],
    },
};
