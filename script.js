document.addEventListener('DOMContentLoaded', () => {
    // 游戏配置
    const config = {
        boardSize: 8,         // 棋盘大小 (8x8)
        tileTypes: 6,         // 方块类型数量
        minMatchLength: 3,    // 最小匹配长度
        animationSpeed: 300,  // 动画速度（毫秒）
        fallSpeed: 100        // 下落速度（毫秒）
    };

    // 游戏状态
    const gameState = {
        board: [],            // 游戏棋盘
        score: 0,             // 分数
        selectedTile: null,   // 当前选中的方块
        isSwapping: false,    // 是否正在交换
        isProcessing: false   // 是否正在处理消除和下落
    };

    // DOM 元素
    const elements = {
        gameBoard: document.getElementById('game-board'),
        scoreDisplay: document.getElementById('score'),
        messageDisplay: document.getElementById('game-message'),
        restartButton: document.getElementById('restart-button'),
        shuffleButton: document.getElementById('shuffle-button'),
        swapSound: document.getElementById('swap-sound'),
        matchSound: document.getElementById('match-sound'),
        noMatchSound: document.getElementById('no-match-sound')
    };

    // 触摸和鼠标事件状态
    const inputState = {
        startX: 0,
        startY: 0,
        startTile: null,
        isDragging: false,
        minSwipeDistance: 10  // 最小滑动距离（像素）
    };

    // 初始化游戏
    function initGame() {
        // 设置棋盘大小
        elements.gameBoard.style.gridTemplateColumns = `repeat(${config.boardSize}, 1fr)`;
        
        // 重置游戏状态
        gameState.board = [];
        gameState.score = 0;
        gameState.selectedTile = null;
        gameState.isSwapping = false;
        gameState.isProcessing = false;
        
        // 更新分数显示
        updateScore(0);
        
        // 清空消息
        showMessage('');
        
        // 清空棋盘
        elements.gameBoard.innerHTML = '';
        
        // 创建初始棋盘
        createInitialBoard();
        
        // 渲染棋盘
        renderBoard();
        
        // 检查初始匹配并消除
        setTimeout(() => {
            processMatches();
        }, 500);
    }

    // 创建初始棋盘
    function createInitialBoard() {
        // 创建一个没有初始匹配的棋盘
        let hasMatches;
        do {
            // 初始化棋盘数组
            gameState.board = Array(config.boardSize).fill().map(() => 
                Array(config.boardSize).fill().map(() => 
                    Math.floor(Math.random() * config.tileTypes) + 1
                )
            );
            
            // 检查初始棋盘是否有匹配
            hasMatches = checkForMatches().length > 0;
        } while (hasMatches);
    }

    // 渲染棋盘
    function renderBoard() {
        elements.gameBoard.innerHTML = '';
        
        for (let row = 0; row < config.boardSize; row++) {
            for (let col = 0; col < config.boardSize; col++) {
                const tileValue = gameState.board[row][col];
                const tile = document.createElement('div');
                
                tile.className = `tile color-${tileValue}`;
                tile.dataset.row = row;
                tile.dataset.col = col;
                
                // 添加触摸和鼠标事件
                addTileEventListeners(tile);
                
                elements.gameBoard.appendChild(tile);
            }
        }
    }

    // 为方块添加事件监听器
    function addTileEventListeners(tile) {
        // 鼠标事件
        tile.addEventListener('mousedown', handleTileMouseDown);
        
        // 触摸事件
        tile.addEventListener('touchstart', handleTileTouchStart, { passive: false });
    }

    // 处理鼠标按下事件
    function handleTileMouseDown(event) {
        if (gameState.isProcessing || gameState.isSwapping) return;
        
        const row = parseInt(event.target.dataset.row);
        const col = parseInt(event.target.dataset.col);
        
        inputState.startTile = { row, col };
        inputState.isDragging = true;
        
        // 记录起始位置
        inputState.startX = event.clientX;
        inputState.startY = event.clientY;
        
        // 选中当前方块
        selectTile(row, col);
        
        // 添加鼠标移动和抬起事件
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        
        event.preventDefault();
    }

    // 处理鼠标移动事件
    function handleMouseMove(event) {
        if (!inputState.isDragging || gameState.isProcessing || gameState.isSwapping) return;
        
        const currentX = event.clientX;
        const currentY = event.clientY;
        
        const deltaX = currentX - inputState.startX;
        const deltaY = currentY - inputState.startY;
        
        // 检查是否达到最小滑动距离
        if (Math.abs(deltaX) > inputState.minSwipeDistance || 
            Math.abs(deltaY) > inputState.minSwipeDistance) {
            
            // 确定滑动方向
            let direction;
            if (Math.abs(deltaX) > Math.abs(deltaY)) {
                direction = deltaX > 0 ? 'right' : 'left';
            } else {
                direction = deltaY > 0 ? 'down' : 'up';
            }
            
            // 尝试交换方块
            trySwapTiles(inputState.startTile.row, inputState.startTile.col, direction);
            
            // 重置拖动状态
            inputState.isDragging = false;
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        }
    }

    // 处理鼠标抬起事件
    function handleMouseUp() {
        inputState.isDragging = false;
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
    }

    // 处理触摸开始事件
    function handleTileTouchStart(event) {
        if (gameState.isProcessing || gameState.isSwapping) return;
        
        const touch = event.touches[0];
        const tile = event.target;
        
        const row = parseInt(tile.dataset.row);
        const col = parseInt(tile.dataset.col);
        
        inputState.startTile = { row, col };
        inputState.startX = touch.clientX;
        inputState.startY = touch.clientY;
        
        // 选中当前方块
        selectTile(row, col);
        
        // 添加触摸移动和结束事件
        tile.addEventListener('touchmove', handleTileTouchMove, { passive: false });
        tile.addEventListener('touchend', handleTileTouchEnd);
        
        event.preventDefault();
    }

    // 处理触摸移动事件
    function handleTileTouchMove(event) {
        if (gameState.isProcessing || gameState.isSwapping) return;
        
        const touch = event.touches[0];
        const currentX = touch.clientX;
        const currentY = touch.clientY;
        
        const deltaX = currentX - inputState.startX;
        const deltaY = currentY - inputState.startY;
        
        // 检查是否达到最小滑动距离
        if (Math.abs(deltaX) > inputState.minSwipeDistance || 
            Math.abs(deltaY) > inputState.minSwipeDistance) {
            
            // 确定滑动方向
            let direction;
            if (Math.abs(deltaX) > Math.abs(deltaY)) {
                direction = deltaX > 0 ? 'right' : 'left';
            } else {
                direction = deltaY > 0 ? 'down' : 'up';
            }
            
            // 尝试交换方块
            trySwapTiles(inputState.startTile.row, inputState.startTile.col, direction);
            
            // 移除事件监听器
            event.target.removeEventListener('touchmove', handleTileTouchMove);
            event.target.removeEventListener('touchend', handleTileTouchEnd);
        }
        
        event.preventDefault();
    }

    // 处理触摸结束事件
    function handleTileTouchEnd(event) {
        event.target.removeEventListener('touchmove', handleTileTouchMove);
        event.target.removeEventListener('touchend', handleTileTouchEnd);
    }

    // 选中方块
    function selectTile(row, col) {
        // 取消之前选中的方块
        if (gameState.selectedTile) {
            const prevTile = getTileElement(gameState.selectedTile.row, gameState.selectedTile.col);
            if (prevTile) prevTile.classList.remove('selected');
        }
        
        // 选中新方块
        const tile = getTileElement(row, col);
        if (tile) tile.classList.add('selected');
        
        gameState.selectedTile = { row, col };
    }

    // 尝试交换方块
    function trySwapTiles(row, col, direction) {
        if (gameState.isSwapping || gameState.isProcessing) return;
        
        // 计算目标位置
        let targetRow = row;
        let targetCol = col;
        
        switch (direction) {
            case 'up':
                targetRow = Math.max(0, row - 1);
                break;
            case 'down':
                targetRow = Math.min(config.boardSize - 1, row + 1);
                break;
            case 'left':
                targetCol = Math.max(0, col - 1);
                break;
            case 'right':
                targetCol = Math.min(config.boardSize - 1, col + 1);
                break;
        }
        
        // 如果目标位置与当前位置相同，不执行交换
        if (targetRow === row && targetCol === col) return;
        
        // 执行交换
        swapTiles(row, col, targetRow, targetCol);
    }

    // 交换方块
    function swapTiles(row1, col1, row2, col2) {
        gameState.isSwapping = true;
        
        // 播放交换音效
        playSound(elements.swapSound);
        
        // 获取方块元素
        const tile1 = getTileElement(row1, col1);
        const tile2 = getTileElement(row2, col2);
        
        // 取消选中状态
        if (tile1) tile1.classList.remove('selected');
        if (tile2) tile2.classList.remove('selected');
        
        // 交换方块值
        const temp = gameState.board[row1][col1];
        gameState.board[row1][col1] = gameState.board[row2][col2];
        gameState.board[row2][col2] = temp;
        
        // 更新方块外观
        updateTileAppearance(row1, col1);
        updateTileAppearance(row2, col2);
        
        // 检查是否形成匹配
        setTimeout(() => {
            const matches = checkForMatches();
            
            if (matches.length > 0) {
                // 有匹配，处理消除
                processMatches();
            } else {
                // 没有匹配，交换回来
                playSound(elements.noMatchSound);
                
                // 交换回方块值
                const temp = gameState.board[row1][col1];
                gameState.board[row1][col1] = gameState.board[row2][col2];
                gameState.board[row2][col2] = temp;
                
                // 更新方块外观
                updateTileAppearance(row1, col1);
                updateTileAppearance(row2, col2);
                
                // 显示消息
                showMessage('无法形成匹配！');
                
                setTimeout(() => {
                    showMessage('');
                    gameState.isSwapping = false;
                }, config.animationSpeed);
            }
        }, config.animationSpeed);
    }

    // 更新方块外观
    function updateTileAppearance(row, col) {
        const tile = getTileElement(row, col);
        if (!tile) return;
        
        // 更新方块类型
        for (let i = 1; i <= config.tileTypes; i++) {
            tile.classList.remove(`color-${i}`);
        }
        
        tile.classList.add(`color-${gameState.board[row][col]}`);
        
        // 更新数据属性
        tile.dataset.row = row;
        tile.dataset.col = col;
    }

    // 获取方块元素
    function getTileElement(row, col) {
        return document.querySelector(`.tile[data-row="${row}"][data-col="${col}"]`);
    }

    // 检查匹配
    function checkForMatches() {
        const matches = [];
        
        // 检查水平匹配
        for (let row = 0; row < config.boardSize; row++) {
            let matchLength = 1;
            let matchType = gameState.board[row][0];
            
            for (let col = 1; col < config.boardSize; col++) {
                if (gameState.board[row][col] === matchType) {
                    matchLength++;
                } else {
                    if (matchLength >= config.minMatchLength) {
                        matches.push({
                            type: matchType,
                            tiles: Array.from({ length: matchLength }, (_, i) => ({ 
                                row, 
                                col: col - matchLength + i 
                            }))
                        });
                    }
                    matchLength = 1;
                    matchType = gameState.board[row][col];
                }
            }
            
            // 检查行末尾的匹配
            if (matchLength >= config.minMatchLength) {
                matches.push({
                    type: matchType,
                    tiles: Array.from({ length: matchLength }, (_, i) => ({ 
                        row, 
                        col: config.boardSize - matchLength + i 
                    }))
                });
            }
        }
        
        // 检查垂直匹配
        for (let col = 0; col < config.boardSize; col++) {
            let matchLength = 1;
            let matchType = gameState.board[0][col];
            
            for (let row = 1; row < config.boardSize; row++) {
                if (gameState.board[row][col] === matchType) {
                    matchLength++;
                } else {
                    if (matchLength >= config.minMatchLength) {
                        matches.push({
                            type: matchType,
                            tiles: Array.from({ length: matchLength }, (_, i) => ({ 
                                row: row - matchLength + i, 
                                col 
                            }))
                        });
                    }
                    matchLength = 1;
                    matchType = gameState.board[row][col];
                }
            }
            
            // 检查列末尾的匹配
            if (matchLength >= config.minMatchLength) {
                matches.push({
                    type: matchType,
                    tiles: Array.from({ length: matchLength }, (_, i) => ({ 
                        row: config.boardSize - matchLength + i, 
                        col 
                    }))
                });
            }
        }
        
        return matches;
    }

    // 处理匹配和消除
    function processMatches() {
        gameState.isProcessing = true;
        
        const matches = checkForMatches();
        
        if (matches.length === 0) {
            // 没有匹配，检查是否有可能的移动
            if (!hasPossibleMoves()) {
                showMessage('没有可能的移动，重新洗牌！');
                setTimeout(() => {
                    shuffleBoard();
                }, 1000);
            } else {
                showMessage('');
            }
            
            gameState.isProcessing = false;
            gameState.isSwapping = false;
            return;
        }
        
        // 播放匹配音效
        playSound(elements.matchSound);
        
        // 标记匹配的方块
        const matchedTiles = new Set();
        
        matches.forEach(match => {
            match.tiles.forEach(tile => {
                const key = `${tile.row},${tile.col}`;
                matchedTiles.add(key);
                
                const tileElement = getTileElement(tile.row, tile.col);
                if (tileElement) {
                    tileElement.classList.add('matched');
                }
            });
        });
        
        // 计算得分
        let scoreGain = 0;
        matches.forEach(match => {
            // 基础分数：每个方块10分
            const baseScore = match.tiles.length * 10;
            
            // 额外奖励：超过最小匹配长度的额外奖励
            const bonusScore = Math.max(0, match.tiles.length - config.minMatchLength) * 5;
            
            scoreGain += baseScore + bonusScore;
        });
        
        // 更新分数
        updateScore(gameState.score + scoreGain);
        
        // 显示消息
        if (matches.length > 1) {
            showMessage(`连击！+${scoreGain}分`);
        } else {
            showMessage(`+${scoreGain}分`);
        }
        
        // 延迟后移除匹配的方块并填充新方块
        setTimeout(() => {
            // 移除匹配的方块
            matchedTiles.forEach(key => {
                const [row, col] = key.split(',').map(Number);
                gameState.board[row][col] = 0; // 标记为空
            });
            
            // 方块下落
            dropTiles();
            
            // 填充新方块
            fillEmptyTiles();
            
            // 更新棋盘显示
            renderBoard();
            
            // 检查是否有新的匹配
            setTimeout(() => {
                const newMatches = checkForMatches();
                if (newMatches.length > 0) {
                    // 有新的匹配，继续处理
                    processMatches();
                } else {
                    // 没有新的匹配，结束处理
                    gameState.isProcessing = false;
                    gameState.isSwapping = false;
                    
                    // 清除消息
                    setTimeout(() => {
                        showMessage('');
                    }, 1000);
                }
            }, config.fallSpeed * config.boardSize);
        }, config.animationSpeed);
    }

    // 方块下落
    function dropTiles() {
        // 从底部向上处理每一列
        for (let col = 0; col < config.boardSize; col++) {
            let emptySpaces = 0;
            
            // 从底部向上遍历
            for (let row = config.boardSize - 1; row >= 0; row--) {
                if (gameState.board[row][col] === 0) {
                    // 空位，增加空位计数
                    emptySpaces++;
                } else if (emptySpaces > 0) {
                    // 有方块且下方有空位，下落
                    gameState.board[row + emptySpaces][col] = gameState.board[row][col];
                    gameState.board[row][col] = 0;
                    
                    // 添加下落动画类
                    const tile = getTileElement(row, col);
                    if (tile) {
                        tile.classList.add('falling');
                        tile.style.transform = `translateY(${emptySpaces * 100}%)`;
                    }
                }
            }
        }
    }

    // 填充空位
    function fillEmptyTiles() {
        for (let col = 0; col < config.boardSize; col++) {
            for (let row = 0; row < config.boardSize; row++) {
                if (gameState.board[row][col] === 0) {
                    // 生成新方块
                    gameState.board[row][col] = Math.floor(Math.random() * config.tileTypes) + 1;
                }
            }
        }
    }

    // 检查是否有可能的移动
    function hasPossibleMoves() {
        // 检查每个位置的四个方向
        for (let row = 0; row < config.boardSize; row++) {
            for (let col = 0; col < config.boardSize; col++) {
                const currentType = gameState.board[row][col];
                
                // 检查向右交换
                if (col < config.boardSize - 1) {
                    // 暂时交换
                    const rightType = gameState.board[row][col + 1];
                    gameState.board[row][col] = rightType;
                    gameState.board[row][col + 1] = currentType;
                    
                    // 检查是否形成匹配
                    const hasMatch = checkForMatches().length > 0;
                    
                    // 交换回来
                    gameState.board[row][col] = currentType;
                    gameState.board[row][col + 1] = rightType;
                    
                    if (hasMatch) return true;
                }
                
                // 检查向下交换
                if (row < config.boardSize - 1) {
                    // 暂时交换
                    const downType = gameState.board[row + 1][col];
                    gameState.board[row][col] = downType;
                    gameState.board[row + 1][col] = currentType;
                    
                    // 检查是否形成匹配
                    const hasMatch = checkForMatches().length > 0;
                    
                    // 交换回来
                    gameState.board[row][col] = currentType;
                    gameState.board[row + 1][col] = downType;
                    
                    if (hasMatch) return true;
                }
            }
        }
        
        return false;
    }

    // 洗牌
    function shuffleBoard() {
        // 收集所有方块
        const allTiles = [];
        for (let row = 0; row < config.boardSize; row++) {
            for (let col = 0; col < config.boardSize; col++) {
                allTiles.push(gameState.board[row][col]);
            }
        }
        
        // 打乱顺序
        for (let i = allTiles.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [allTiles[i], allTiles[j]] = [allTiles[j], allTiles[i]];
        }
        
        // 重新填充棋盘
        let index = 0;
        for (let row = 0; row < config.boardSize; row++) {
            for (let col = 0; col < config.boardSize; col++) {
                gameState.board[row][col] = allTiles[index++];
            }
        }
        
        // 确保没有初始匹配
        while (checkForMatches().length > 0) {
            shuffleBoard();
        }
        
        // 确保有可能的移动
        if (!hasPossibleMoves()) {
            shuffleBoard();
        }
        
        // 更新棋盘显示
        renderBoard();
        
        // 清除消息
        showMessage('');
    }

    // 更新分数
    function updateScore(newScore) {
        gameState.score = newScore;
        elements.scoreDisplay.textContent = newScore;
    }

    // 显示消息
    function showMessage(message) {
        elements.messageDisplay.textContent = message;
    }

    // 播放音效
    function playSound(audioElement) {
        if (audioElement) {
            audioElement.currentTime = 0;
            audioElement.play().catch(e => {
                // 忽略自动播放限制错误
                console.log('音效播放失败:', e);
            });
        }
    }

    // 事件监听器
    elements.restartButton.addEventListener('click', () => {
        initGame();
    });

    elements.shuffleButton.addEventListener('click', () => {
        if (gameState.isProcessing || gameState.isSwapping) return;
        shuffleBoard();
    });

    // 添加全局触摸和鼠标事件
    document.addEventListener('touchmove', (e) => {
        if (gameState.isProcessing || gameState.isSwapping) {
            e.preventDefault();
        }
    }, { passive: false });

    // 初始化游戏
    initGame();
}); 