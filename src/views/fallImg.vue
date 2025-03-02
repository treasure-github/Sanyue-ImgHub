<template>
  <div class="waterfall-container" ref="container">
    <div class="waterfall-grid">
      <div 
        v-for="(image, index) in images" 
        :key="index" 
        class="image-item" 
        :style="{ 
          left: `${image.column * columnWidth}px`,
          top: `${image.top}px`,
          width: `${columnWidth}px`,
          height: `${image.height}px`
        }"
      >
        <img 
          :src="image.url" 
          :alt="'Image ' + index" 
          loading="lazy" 
          @load="updateImageHeight(image, index)" 
        />
      </div>
    </div>
    <p v-if="loading" class="loading-text">加载中...</p>
  </div>
</template>

<script>
import { mapGetters } from 'vuex';

export default {
  data() {
    return {
      images: [],
      minWidth: 250,
      columnCount: 3,
      columnWidth: 0,
      columns: [], // 存放每列当前累积的高度
      loading: false,
      observer: null,
      resizeTimeout: null,
    };
  },
  mounted() {
    this.$nextTick(() => {
      this.updateColumnCount();
      window.addEventListener("resize", this.onResize);
    });
    this.loadImages();
    this.initObserver();
  },
  computed: {
    ...mapGetters(['credentials', 'adminUrlSettings', 'userConfig']),
  },
  beforeDestroy() {
    if (this.observer) this.observer.disconnect();
    window.removeEventListener("resize", this.onResize);
  },
  methods: {
    // 监听窗口大小变化
    onResize() {
      clearTimeout(this.resizeTimeout);
      this.resizeTimeout = setTimeout(() => {
        this.updateColumnCount();
      }, 300); // 延迟 300ms 避免频繁触发
    },

    // 初始化 IntersectionObserver 监听滚动
    initObserver() {
      if (!this.observer) {
        this.observer = new IntersectionObserver(entries => {
          if (entries[0]?.isIntersecting) {
            this.loadImages();
          }
        }, { threshold: 0.5 });

        this.observeSecondLastRow();
      }
    },

    // 计算列数，并重新布局
    updateColumnCount() {
      if (!this.$refs?.container) return;
      const containerWidth = this.$refs.container.clientWidth;
      this.columnCount = Math.max(1, Math.floor(containerWidth / this.minWidth));
      this.columnWidth = containerWidth / this.columnCount;

      // 重新初始化列高度
      this.columns = new Array(this.columnCount).fill(0);
      this.reflowImages(); // 重新布局图片
    },

    // 重新布局图片
    async reflowImages() {
      if (!this.images.length) return;

      // 更新列数
      const newColumns = new Array(this.columnCount).fill(0);

      // 更新每张图片的位置
      const updatedImages = this.images.map(image => {
        const minCol = this.getMinColumnIndex(newColumns);
        image.column = minCol;
        image.top = newColumns[minCol];
        newColumns[minCol] += image.height;
        return image;
      });

      this.columns = newColumns;
      this.images = updatedImages;
    },

    // 获取最矮列的索引
    getMinColumnIndex(columns) {
      return columns.indexOf(Math.min(...columns));
    },

    observeSecondLastRow() {
      this.$nextTick(() => {
        const target = this.getSecondLastRowImage();
        if (target) {
          this.observer.observe(target);
        }
      });
    },
    getSecondLastRowImage() {
      const imageItems = this.$el.querySelectorAll(".image-item");
      const imagesPerRow = this.columnCount;
      const startIndex = Math.max(0, imageItems.length - imagesPerRow * 2);
      const lastSecondRowImages = Array.from(imageItems).slice(startIndex, startIndex + imagesPerRow);
      return lastSecondRowImages[lastSecondRowImages.length - 1] || null;
    },

    // 加载图片
    async loadImages() {
      console.log('加载中')
      if (this.loading) return;
      this.loading = true;

      if (this.columnWidth === 0) {
        this.updateColumnCount();
      }

      try {
        const loadImg = await this.fetchWithAuth("/api/manage/check", { method: 'GET' })
          .then(response => response.text())
          .then(result => {
            if (result == "true" || result == "Not using basic auth.") {
              return this.fetchWithAuth(`/api/manage/list?start=${this.images.length}&count=20&random=true`, { method: 'GET' });
            } else {
              throw new Error('Unauthorized');
            }
          })
          .then(response => response.json());

        const newImages = await Promise.all(loadImg.map(async (e) => {
          let computedHeight = 0;
          let url = '/file/' + e.name;
          
          if (e.height && e.width) {
            const aspectRatio = e.height / e.width;
            computedHeight = this.columnWidth * aspectRatio;
          } else {
            let { height, width } = await this.loadImageSize(url);
            const aspectRatio = height / width;
            computedHeight = this.columnWidth * aspectRatio;
          }

          if (e.metadata?.Channel === 'TelegramNew') {
                e.channelTag = 'TG';
            } else if (e.metadata?.Channel === 'CloudflareR2') {
                e.channelTag = 'R2';
            } else if (e.metadata?.Channel === 'S3') {
                e.channelTag = 'S3';
            } else {
                e.channelTag = '未知';
            }

          return {
            url: url,
            height: computedHeight,
            column: 0,  
            top: 0,
            channelTag:  e.channelTag 
          };
        }));

        this.images.push(...newImages);
        await this.reflowImages(); // 布局重新计算
      } catch (err) {
        console.error(err);
        if (err.message !== 'Unauthorized') {
          this.$message.error('同步数据时出错，请检查网络连接');
        }
      } finally {
        this.loading = false;
        this.observeSecondLastRow();
      }
    },

    // 更新图片高度
    updateImageHeight(image, index) {
      this.$nextTick(() => {
        const imgElement = this.$el.querySelectorAll(".image-item img")[index];
        if (imgElement) {
          image.height = imgElement.clientHeight;
          // 延迟重新布局
          requestAnimationFrame(() => {
            this.reflowImages();
          });
        }
      });
    },

    loadImageSize(url) {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          resolve({ width: img.width, height: img.height });
        };
        img.onerror = reject;
        img.src = url;
      });
    },

    async fetchWithAuth(url, options = {}) {
      if (this.credentials) {
        options.headers = {
          ...options.headers,
          'Authorization': `Basic ${this.credentials}`,
        };
        options.credentials = 'include';
      }

      const response = await fetch(url, options);

      if (response.status === 401) {
        this.$message.error('认证状态错误，请重新登录');
        this.$router.push('/adminLogin');
        throw new Error('Unauthorized');
      }

      return response;
    },
  },
};
</script>

<style scoped>
.waterfall-container {
  max-width: 100%;
  margin: 0 auto;
  padding: 0;
  position: relative;
}
.waterfall-grid {
  position: relative;
  width: 100%;
}
.image-item {
  position: absolute;
  transition: all 0.3s ease;
}
.image-item img {
  width: 100%;
  display: block;
}
.loading-text {
  text-align: center;
  font-size: 14px;
  color: #888;
  padding: 10px;
}
</style>
